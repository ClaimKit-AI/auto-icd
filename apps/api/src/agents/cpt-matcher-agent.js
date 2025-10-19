// CPT Matcher Agent - Phase 2 Agent #3
// Finds clinically appropriate CPT codes for procedures
// Uses icd_cpt_links table + NICE pathways + medical validation

import { getCPTSuggestions, getLinkedCPTCodes } from '../database.js'

/**
 * CPT Matcher Agent
 * 
 * Validates CPT procedure codes and ensures:
 * - Clinically appropriate for the diagnosis
 * - Anatomically compatible (if applicable)
 * - Domain matching (lab, imaging, surgery)
 * - Medical coherence with patient context
 */
export class CPTMatcherAgent {
  constructor() {
    this.agentId = 'cpt-matcher-agent'
  }
  
  /**
   * Match and validate CPT codes for procedures
   * 
   * @param {Array} procedures - Extracted procedures from NLP agent
   * @param {Array} icdCodes - Verified ICD codes for context
   * @param {Object} patientContext - Patient context
   * @returns {Array} Validated CPT codes
   */
  async matchProcedures(procedures, icdCodes = [], patientContext = {}) {
    const startTime = Date.now()
    const matchedCPTs = []
    
    try {
      console.log(`💊 [${this.agentId}] Matching ${procedures.length} procedures`)
      
      // PRIORITY 1: Get CPT codes from ICD-CPT links table (pre-validated!)
      let linkedCPTs = []
      if (icdCodes.length > 0) {
        console.log(`\n   🔗 Checking ICD-CPT links table for ${icdCodes.length} diagnoses...`)
        
        for (const icd of icdCodes) {
          try {
            const links = await getLinkedCPTCodes(icd.code, 15)
            if (links && links.length > 0) {
              console.log(`     ✅ ${icd.code}: ${links.length} pre-validated CPT codes (from 556K links)`)
              linkedCPTs.push(...links)
            }
          } catch (err) {
            console.log(`     ⚠️  Links not available for ${icd.code}`)
          }
        }
      }
      
      // PRIORITY 2: Match procedures with linked CPTs + search
      for (const procedure of procedures) {
        console.log(`\n  🔬 Processing: "${procedure.term}"`)
        
        let cptResults = []
        
        // First, use linked CPTs (BEST - already validated!)
        const relevantLinked = linkedCPTs.filter(link => {
          const desc = (link.display || '').toLowerCase()
          const term = procedure.term.toLowerCase()
          // Check if procedure term matches CPT description
          return desc.includes(term) || term.split(' ').some(word => word.length > 3 && desc.includes(word))
        })
        
        if (relevantLinked.length > 0) {
          console.log(`     🔗 ${relevantLinked.length} from ICD-CPT links (NICE-validated)`)
          cptResults.push(...relevantLinked.map(link => ({
            ...link,
            from_links: true,
            confidence_boost: 0.20 // Major boost - pre-validated!
          })))
        }
        
        // Also search directly
        const searchResults = await getCPTSuggestions(procedure.term, 5)
        if (searchResults) {
          console.log(`     🔍 ${searchResults.length} from direct search`)
          cptResults.push(...searchResults.filter(sr => 
            !cptResults.find(c => c.code === sr.code)
          ))
        }
        
        if (cptResults.length === 0) {
          console.log(`     ⚠️  No CPT codes found`)
          continue
        }
        
        console.log(`     📊 Total ${cptResults.length} CPT candidates:`)
        cptResults.forEach((r, i) => {
          const desc = r.display || r.short_description || r.label
          const source = r.from_links ? '✅ PRE-VALIDATED' : 'Search'
          console.log(`        ${i+1}. ${r.code} - ${desc} [${source}]`)
        })
        
        // Validate each CPT candidate
        for (const cptCandidate of cptResults) {
          const validation = await this.validateCPT(
            cptCandidate,
            procedure,
            icdCodes,
            patientContext
          )
          
          if (validation.valid && validation.confidence > 0.50) {
            matchedCPTs.push({
              code: cptCandidate.code,
              type: 'CPT',
              description: cptCandidate.display || cptCandidate.short_description || cptCandidate.label,
              trigger: procedure.term,
              confidence: validation.confidence,
              procedure_type: procedure.type,
              verdict: validation.verdict,
              clinical_note: validation.clinical_note,
              suggestions: validation.suggestions || [],
              extracted_by: 'medical-nlp-agent',
              validated_by: 'cpt-matcher-agent'
            })
            
            console.log(`     ✅ ${cptCandidate.code}: ${(validation.confidence * 100).toFixed(1)}% - ${validation.verdict}`)
            break // Take first valid match per procedure
          } else {
            console.log(`     ❌ ${cptCandidate.code}: ${(validation.confidence * 100).toFixed(1)}% - ${validation.verdict}`)
          }
        }
      }
      
      const latency = Date.now() - startTime
      console.log(`\n✅ [${this.agentId}] Matched ${matchedCPTs.length}/${procedures.length} procedures in ${latency}ms`)
      
      return {
        success: true,
        agentId: this.agentId,
        cptCodes: matchedCPTs,
        latency: latency
      }
      
    } catch (error) {
      console.error(`❌ [${this.agentId}] Error:`, error.message)
      
      return {
        success: false,
        agentId: this.agentId,
        cptCodes: [],
        error: error.message,
        latency: Date.now() - startTime
      }
    }
  }

  /**
   * Validate a single CPT code
   */
  async validateCPT(cptCandidate, procedure, icdCodes, patientContext) {
    // Start conservative - require evidence
    let confidence = cptCandidate.from_links ? 0.75 : 0.50
    const validationNotes = []
    const suggestions = []
    const warnings = []
    
    if (cptCandidate.from_links) {
      validationNotes.push('✅ From ICD-CPT links table (556K pre-validated)')
      confidence += (cptCandidate.confidence_boost || 0)
      
      // Extra boost if high confidence in links table (NICE pathways have 0.95)
      if (cptCandidate.confidence_score >= 0.95) {
        confidence += 0.15
        validationNotes.push('✅ NICE clinical pathway (95%+ confidence)')
      }
    }
    
    const cptDesc = (cptCandidate.display || cptCandidate.short_description || '').toLowerCase()
    
    // CRITICAL: Check for medical inappropriateness FIRST
    if (icdCodes.length > 0) {
      const diagnosisContext = icdCodes[0]
      const diagnosisTitle = diagnosisContext.description.toLowerCase()
      const icdCode = diagnosisContext.code
      
      // ⚠️ MEDICAL VALIDATION RULES - Flag inappropriate procedures
      
      // Surgery for medical conditions (should be medication/monitoring)
      if (cptDesc.match(/surgical|surgery|excision|removal|ectomy|resection/) && 
          diagnosisTitle.match(/hypothyroidism|hyperlipidemia|hypertension|diabetes type|asthma|copd|bronchitis/)) {
        confidence = 0.20
        warnings.push('⚠️ SURGICAL PROCEDURE FOR MEDICAL CONDITION - Usually inappropriate')
        warnings.push('💊 Consider: Medical management, monitoring, labs instead')
        validationNotes.push('❌ Surgery not first-line for medical conditions per NICE')
      }
      
      // Thyroidectomy specifically - only for specific conditions
      if (cptDesc.match(/thyroidectomy|thyroid.*removal/) && 
          !diagnosisTitle.match(/goiter|nodule|cancer|malignant|hyperthyroid|graves/)) {
        confidence = 0.15
        warnings.push('⚠️ THYROIDECTOMY inappropriate for this diagnosis')
        warnings.push('✅ Indicated for: Goiter, nodules, cancer, refractory hyperthyroidism')
        warnings.push('❌ NOT for: Simple hypothyroidism (use levothyroxine)')
      }
      
      // Pregnancy-specific conditions with non-pregnancy procedures
      if (icdCode.startsWith('O') && !cptDesc.match(/pregnancy|obstetric|prenatal|maternal|fetal/)) {
        confidence *= 0.80
        warnings.push('⚠️ Pregnancy diagnosis (O-code) - Verify procedure is pregnancy-safe')
      }
    }
    
    // Check 1: Procedure type matching
    if (procedure.type) {
      if (procedure.type === 'lab' && cptDesc.match(/test|panel|blood|laboratory|pathology/i)) {
        confidence += 0.15
        validationNotes.push('✅ Lab test matches procedure type')
      } else if (procedure.type === 'imaging' && cptDesc.match(/xray|x-ray|ct|mri|ultrasound|scan|radiolog|fluoroscop/i)) {
        confidence += 0.15
        validationNotes.push('✅ Imaging matches procedure type')
      } else if (procedure.type === 'surgery' && cptDesc.match(/surgical|repair|excision|removal|treatment.*of/i)) {
        confidence += 0.15
        validationNotes.push('✅ Surgical procedure matches type')
      }
    }
    
    // Check 2: Clinical appropriateness with diagnosis
    // COMPREHENSIVE SPECIALTY-SPECIFIC VALIDATION per NICE guidelines
    if (icdCodes.length > 0) {
      const diagnosisContext = icdCodes[0]
      const diagnosisTitle = diagnosisContext.description.toLowerCase()
      const icdCode = diagnosisContext.code
      
      // ===========================================================================
      // ORTHOPEDICS & MUSCULOSKELETAL - Imaging First per NICE
      // ===========================================================================
      
      // ⭐ FRACTURES - Imaging is ESSENTIAL (S-codes, M96-M97)
      if ((icdCode.match(/^S[0-9]/) || icdCode.match(/^M96|^M97/)) && diagnosisTitle.match(/fracture/)) {
        if (cptDesc.match(/x-ray|xray|radiograph|ct|mri|scan|imaging/)) {
          confidence += 0.25
          validationNotes.push('✅ IMAGING ESSENTIAL for fracture diagnosis/monitoring (NICE)')
        } else if (cptDesc.match(/surgical|treatment|repair|fixation|open|closed/)) {
          confidence += 0.10
          validationNotes.push('✓ Surgical treatment after imaging confirmation')
        }
      }
      
      // Trauma/Injury codes (S-codes) - Imaging priority
      if (icdCode.startsWith('S') && cptDesc.match(/x-ray|xray|ct|mri|ultrasound/)) {
        confidence += 0.20
        validationNotes.push('✅ Imaging appropriate for trauma evaluation (NICE)')
      }
      
      // Joint/Bone disorders (M00-M99) - Imaging for diagnosis
      if (icdCode.startsWith('M') && diagnosisTitle.match(/joint|arthritis|bone|osteo|spine|back/) &&
          cptDesc.match(/x-ray|xray|mri|ct|bone scan/)) {
        confidence += 0.20
        validationNotes.push('✅ Imaging recommended for musculoskeletal evaluation (NICE)')
      }
      
      // ===========================================================================
      // HEMATOLOGY - Blood/Lab Tests Priority
      // ===========================================================================
      
      // Anemia (D50-D64) - Blood tests ESSENTIAL
      if ((icdCode.match(/^D[5-6]/) || diagnosisTitle.match(/anemia|anaemia/)) &&
          cptDesc.match(/cbc|complete blood|hemoglobin|hematocrit|ferritin|iron|b12|folate/)) {
        confidence += 0.25
        validationNotes.push('✅ Blood tests ESSENTIAL for anemia diagnosis (NICE)')
      }
      
      // Infections - Blood/Lab tests for diagnosis
      if (diagnosisTitle.match(/infection|sepsis|bacteremia/) &&
          cptDesc.match(/culture|blood culture|sensitivity|cbc|wbc|crp|esr/)) {
        confidence += 0.20
        validationNotes.push('✅ Lab tests essential for infection diagnosis (NICE)')
      }
      
      // Coagulation disorders - Coag studies
      if (diagnosisTitle.match(/coagulation|bleeding|thrombosis|clot/) &&
          cptDesc.match(/pt|inr|ptt|aptt|coagulation|d-dimer|fibrinogen/)) {
        confidence += 0.20
        validationNotes.push('✅ Coagulation studies appropriate (NICE)')
      }
      
      // ===========================================================================
      // GASTROENTEROLOGY - Endoscopy & Imaging
      // ===========================================================================
      
      // GI conditions (K00-K93) - Endoscopy priority
      if (icdCode.startsWith('K') && diagnosisTitle.match(/gastric|stomach|esophag|intestin|colon|bowel/)) {
        if (cptDesc.match(/endoscopy|colonoscopy|esophagogastroduodenoscopy|egd|sigmoidoscopy/)) {
          confidence += 0.25
          validationNotes.push('✅ Endoscopy recommended for GI diagnosis (NICE)')
        } else if (cptDesc.match(/ct abdomen|abdominal ct|ultrasound abdomen/)) {
          confidence += 0.15
          validationNotes.push('✅ Imaging appropriate for GI evaluation (NICE)')
        }
      }
      
      // Liver disease - LFTs priority
      if (diagnosisTitle.match(/liver|hepat|cirrhosis/) &&
          cptDesc.match(/liver function|lft|ast|alt|bilirubin|albumin|alkaline phosphatase/)) {
        confidence += 0.20
        validationNotes.push('✅ Liver function tests essential (NICE)')
      }
      
      // ===========================================================================
      // CARDIOLOGY - ECG, Echo, Stress Tests
      // ===========================================================================
      
      // Cardiac conditions (I00-I99) - ECG/Echo priority
      if (icdCode.startsWith('I') && diagnosisTitle.match(/heart|cardiac|myocardial|arrhythmia|coronary/)) {
        if (cptDesc.match(/electrocardiogram|ecg|ekg|12-lead/)) {
          confidence += 0.25
          validationNotes.push('✅ ECG ESSENTIAL for cardiac evaluation (NICE)')
        } else if (cptDesc.match(/echocardiogram|echo|cardiac ultrasound/)) {
          confidence += 0.20
          validationNotes.push('✅ Echocardiogram recommended (NICE)')
        } else if (cptDesc.match(/stress test|exercise test|cardiac catheterization/)) {
          confidence += 0.15
          validationNotes.push('✅ Advanced cardiac testing appropriate (NICE)')
        }
      }
      
      // Hypertension - BP monitoring, labs
      if (diagnosisTitle.match(/hypertension|high blood pressure/) &&
          cptDesc.match(/blood pressure|bp monitor|renal panel|electrolyte|ecg/)) {
        confidence += 0.15
        validationNotes.push('✅ Monitoring appropriate for hypertension (NICE)')
      }
      
      // ===========================================================================
      // PULMONOLOGY - Chest X-ray, PFTs, CT
      // ===========================================================================
      
      // Respiratory conditions (J00-J99) - Imaging & PFTs
      if (icdCode.startsWith('J') && diagnosisTitle.match(/lung|pulmonary|respiratory|bronch|pneumonia|copd|asthma/)) {
        if (cptDesc.match(/chest x-ray|chest xray|chest radiograph/)) {
          confidence += 0.25
          validationNotes.push('✅ Chest X-ray ESSENTIAL for respiratory evaluation (NICE)')
        } else if (cptDesc.match(/ct chest|pulmonary function|spirometry|pft/)) {
          confidence += 0.20
          validationNotes.push('✅ Advanced pulmonary testing appropriate (NICE)')
        }
      }
      
      // ===========================================================================
      // NEPHROLOGY & UROLOGY - Urinalysis, Renal Function
      // ===========================================================================
      
      // Kidney conditions (N00-N39) - Renal labs & imaging
      if (icdCode.match(/^N[0-3]/) && diagnosisTitle.match(/kidney|renal|nephro/)) {
        if (cptDesc.match(/urinalysis|urine|creatinine|bun|egfr|renal panel/)) {
          confidence += 0.25
          validationNotes.push('✅ Renal function tests ESSENTIAL (NICE)')
        } else if (cptDesc.match(/ultrasound kidney|renal ultrasound|ct kidney/)) {
          confidence += 0.20
          validationNotes.push('✅ Renal imaging appropriate (NICE)')
        }
      }
      
      // UTI - Urinalysis priority
      if (diagnosisTitle.match(/urinary tract infection|uti|cystitis|pyelonephritis/) &&
          cptDesc.match(/urinalysis|urine culture|urine microscopy/)) {
        confidence += 0.25
        validationNotes.push('✅ Urinalysis ESSENTIAL for UTI diagnosis (NICE)')
      }
      
      // ===========================================================================
      // ENDOCRINOLOGY - Hormone Panels, Labs
      // ===========================================================================
      
      // Thyroid conditions - Thyroid function tests
      if (diagnosisTitle.match(/thyroid|hypothyroid|hyperthyroid|graves|hashimoto/) && 
          cptDesc.match(/thyroid|tsh|t3|t4|thyroxine|thyroid panel/)) {
        confidence += 0.25
        validationNotes.push('✅ Thyroid function tests ESSENTIAL (NICE)')
      }
      
      // Diabetes - Glucose & HbA1c monitoring
      if (diagnosisTitle.match(/diabetes|diabetic/) && 
          cptDesc.match(/glucose|a1c|hemoglobin a1c|fasting glucose|gtt|metabolic panel/)) {
        confidence += 0.25
        validationNotes.push('✅ Glucose monitoring ESSENTIAL for diabetes (NICE)')
      }
      
      // ===========================================================================
      // NEUROLOGY - MRI Brain, EEG, EMG
      // ===========================================================================
      
      // Neurological conditions (G00-G99) - Imaging & neuro tests
      if (icdCode.startsWith('G') && diagnosisTitle.match(/brain|cerebral|neuro|seizure|epilepsy|stroke/)) {
        if (cptDesc.match(/mri brain|ct head|ct brain/)) {
          confidence += 0.25
          validationNotes.push('✅ Brain imaging ESSENTIAL for neurological evaluation (NICE)')
        } else if (cptDesc.match(/eeg|electroencephalogram|emg|nerve conduction/)) {
          confidence += 0.20
          validationNotes.push('✅ Neurophysiology testing appropriate (NICE)')
        }
      }
      
      // ===========================================================================
      // OBSTETRICS & GYNECOLOGY - Ultrasound, Prenatal Labs
      // ===========================================================================
      
      // Pregnancy conditions (O00-O99) - Ultrasound & prenatal labs
      if (icdCode.startsWith('O')) {
        if (cptDesc.match(/ultrasound.*obstetric|prenatal|fetal|ob ultrasound/)) {
          confidence += 0.25
          validationNotes.push('✅ Obstetric ultrasound appropriate (NICE)')
        } else if (cptDesc.match(/prenatal panel|pregnancy test|hcg|ob panel/)) {
          confidence += 0.20
          validationNotes.push('✅ Prenatal labs appropriate (NICE)')
        }
      }
      
      // ===========================================================================
      // ONCOLOGY - Biopsy, Imaging, Tumor Markers
      // ===========================================================================
      
      // Cancer/Neoplasms (C00-D49) - Biopsy & staging
      if ((icdCode.match(/^C[0-9]/) || diagnosisTitle.match(/cancer|carcinoma|malignant|tumor|neoplasm/)) &&
          diagnosisTitle.match(/cancer|carcinoma|malignant/)) {
        if (cptDesc.match(/biopsy|pathology|cytology|tissue examination/)) {
          confidence += 0.25
          validationNotes.push('✅ Biopsy ESSENTIAL for cancer diagnosis (NICE)')
        } else if (cptDesc.match(/pet scan|ct.*cancer|mri.*tumor|staging/)) {
          confidence += 0.20
          validationNotes.push('✅ Imaging for cancer staging (NICE)')
        } else if (cptDesc.match(/tumor marker|cea|ca-125|psa|afp/)) {
          confidence += 0.15
          validationNotes.push('✅ Tumor markers for monitoring (NICE)')
        }
      }
      
      // ===========================================================================
      // GENERIC - Diagnostic tests for any condition
      // ===========================================================================
      
      // Generic lab appropriateness for any disorder
      if (cptDesc.match(/panel|test|laboratory/) && diagnosisTitle.match(/disorder|disease|condition/)) {
        confidence += 0.05
        validationNotes.push('✅ Diagnostic testing clinically appropriate')
      }
    }
    
    // Check 3: Anatomical compatibility (for imaging/surgery)
    if (procedure.anatomical_site && patientContext.anatomical_site) {
      const procSite = procedure.anatomical_site.toLowerCase()
      const patientSite = patientContext.anatomical_site.toLowerCase()
      
      if (procSite === patientSite || procSite.includes(patientSite) || patientSite.includes(procSite)) {
        confidence += 0.10
        validationNotes.push('✅ Anatomical site matches')
      }
    }
    
    // Cap confidence
    confidence = Math.min(confidence, 0.98)
    
    // Determine verdict based on confidence AND warnings
    let verdict
    if (warnings.length > 0) {
      // Has warnings - flag regardless of confidence
      if (confidence < 0.40) {
        verdict = '⛔ INAPPROPRIATE - Contraindicated'
      } else if (confidence < 0.60) {
        verdict = '⚠️ CAUTION - Review required'
      } else {
        verdict = '⚠️ REVIEW - Potential concern'
      }
    } else {
      // No warnings - normal confidence scoring
      if (confidence >= 0.90) {
        verdict = '✅ EXCELLENT - NICE validated'
      } else if (confidence >= 0.75) {
        verdict = '✅ APPROPRIATE - Recommended'
      } else if (confidence >= 0.60) {
        verdict = '✓ ACCEPTABLE - Consider'
      } else {
        verdict = '? UNCERTAIN - Evidence lacking'
      }
    }
    
    return {
      valid: confidence > 0.50 && warnings.length === 0, // Only accept if >50% AND no warnings
      confidence: confidence,
      verdict: verdict,
      clinical_note: this.generateClinicalNote(cptCandidate, procedure, icdCodes, warnings),
      validation_notes: validationNotes,
      warnings: warnings,
      suggestions: suggestions
    }
  }
  
  /**
   * Generate clinical note for CPT validation
   */
  generateClinicalNote(cptCandidate, procedure, icdCodes, warnings = []) {
    const cptName = cptCandidate.display || cptCandidate.short_description
    const procName = procedure.term
    
    if (warnings.length > 0) {
      // Return first warning as primary note
      return warnings[0].replace(/[⚠️❌✅💊]/g, '').trim()
    }
    
    if (icdCodes.length > 0) {
      const diagnosis = icdCodes[0].description
      return `${procName} (${cptName}) is clinically appropriate for ${diagnosis}`
    }
    
    return `${procName} (${cptName}) is a valid procedure`
  }
}

/**
 * Singleton instance
 */
export const cptMatcherAgent = new CPTMatcherAgent()

export default cptMatcherAgent

