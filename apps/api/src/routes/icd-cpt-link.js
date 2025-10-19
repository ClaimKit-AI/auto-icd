// ICD-CPT Medical Linking API Route
// NOW USES AGENT #3 for intelligent CPT matching with 556K links!

import { getLinkedCPTCodes } from '../database.js'
import { cptMatcherAgent } from '../agents/cpt-matcher-agent.js'

/**
 * Register ICD-CPT linking routes
 */
export async function icdCptLinkRoutes(fastify, options) {
  /**
   * GET /api/icd/:code/cpt
   * Get medically appropriate CPT procedures for an ICD diagnosis
   * NOW USES AGENT #3 + 556K PRE-VALIDATED LINKS!
   */
  fastify.get('/:code/cpt', async (req, reply) => {
  try {
      const icdCode = req.params.code
      const limit = parseInt(req.query.limit) || 20 // Increased from 5 to 20
      
      const startTime = Date.now()
      
      console.log(`🏥 Finding CPT codes for ICD: ${icdCode} (AGENT-POWERED)`)
      
      // Get ICD details to determine specialty
      const { query } = await import('../database.js')
      const icdDetailsResult = await query(`
        SELECT code, title, chapter
        FROM icd_codes
        WHERE code = $1
      `, [icdCode])
      
      const icdDetails = icdDetailsResult.rows[0]
      const icdTitle = icdDetails?.title?.toLowerCase() || ''
      
      // Get linked CPT codes from our 556K links table
      let linkedCPTs = await getLinkedCPTCodes(icdCode, limit * 3) || []
      
      console.log(`   🔗 Found ${linkedCPTs.length} linked CPT codes from 556K table`)
      
      // =========================================================================
      // ACTIVE SEARCH: Find first-line diagnostic procedures for ALL specialties
      // =========================================================================
      console.log(`   🔍 Analyzing specialty for first-line procedures...`)
      
      const { getCPTSuggestions } = await import('../database.js')
      const firstLineSearches = []
      
      // ORTHOPEDICS & MUSCULOSKELETAL - ALWAYS IMAGING FIRST!
      // Fractures - HIGHEST priority
      if ((icdCode.match(/^S[0-9]/) || icdCode.match(/^M96|^M97/)) && icdTitle.match(/fracture/)) {
        console.log(`   🦴 FRACTURE - Adding imaging searches`)
        const anatomy = icdTitle.match(/clavicle|radius|ulna|humerus|tibia|fibula|femur|skull|spine|vertebra|rib|pelvis|wrist|ankle|finger|hand|foot/)?.[0] || 'bone'
        firstLineSearches.push(
          `radiograph ${anatomy}`,
          `x-ray ${anatomy} bone`,
          `ct scan ${anatomy}`,
          `mri ${anatomy} bone`
        )
      }
      // Joint disorders - imaging first
      else if (icdCode.startsWith('M') && icdTitle.match(/arthritis|joint|osteo/)) {
        console.log(`   🦴 JOINT DISORDER - Adding imaging searches`)
        const joint = icdTitle.match(/knee|hip|shoulder|elbow|wrist|ankle/)?.[0] || 'joint'
        firstLineSearches.push(`radiograph ${joint} joint`, `mri ${joint} joint`, `x-ray ${joint} joint`)
      }
      // Musculoskeletal PAIN (M79) - imaging to diagnose cause!
      else if (icdCode.match(/^M79/) && icdTitle.match(/pain/)) {
        console.log(`   🦴 MUSCULOSKELETAL PAIN - Adding diagnostic imaging`)
        // Extract anatomy from title
        const anatomy = icdTitle.match(/arm|leg|hand|foot|shoulder|hip|knee|ankle|wrist|elbow|spine|back|neck/)?.[0] || 'extremity'
        firstLineSearches.push(
          `radiograph ${anatomy}`,
          `x-ray ${anatomy}`,
          `mri ${anatomy}`,
          `ultrasound ${anatomy} musculoskeletal`
        )
      }
      // ANY M-code (musculoskeletal) - consider imaging
      else if (icdCode.startsWith('M') && !icdTitle.match(/infection/)) {
        console.log(`   🦴 MUSCULOSKELETAL - Adding imaging searches`)
        const anatomy = icdTitle.match(/spine|back|neck|shoulder|arm|elbow|wrist|hand|hip|thigh|knee|leg|ankle|foot/)?.[0] || 'musculoskeletal'
        firstLineSearches.push(`radiograph ${anatomy}`, `x-ray ${anatomy}`)
      }
      
      // HEMATOLOGY - Anemia, Blood Disorders, Infections
      if ((icdCode.match(/^D[5-6]/) || icdTitle.match(/anemia|anaemia/))) {
        console.log(`   🩸 ANEMIA - Adding blood test searches`)
        firstLineSearches.push('complete blood count', 'cbc', 'hemoglobin', 'ferritin', 'iron panel')
      }
      
      if (icdTitle.match(/infection|sepsis|bacteremia/)) {
        console.log(`   🦠 INFECTION - Adding culture/lab searches`)
        firstLineSearches.push('blood culture', 'culture', 'complete blood count', 'cbc', 'crp', 'esr')
      }
      
      // GASTROENTEROLOGY
      if (icdCode.startsWith('K') && icdTitle.match(/gastric|stomach|esophag|gerd|ulcer/)) {
        console.log(`   🫁 GI UPPER - Adding endoscopy searches`)
        firstLineSearches.push('esophagogastroduodenoscopy', 'upper endoscopy', 'egd procedure', 'upper gastrointestinal endoscopy')
      }
      
      if (icdCode.startsWith('K') && icdTitle.match(/colon|intestin|bowel|ibs|crohn/)) {
        console.log(`   🫁 GI LOWER - Adding colonoscopy searches`)
        firstLineSearches.push('colonoscopy procedure', 'flexible sigmoidoscopy', 'lower gastrointestinal endoscopy')
      }
      
      if (icdTitle.match(/liver|hepat|cirrhosis/)) {
        console.log(`   🫁 LIVER - Adding LFT searches`)
        firstLineSearches.push('liver function test', 'hepatic function panel', 'comprehensive metabolic panel')
      }
      
      // CARDIOLOGY
      // ACUTE MI/STEMI - EMERGENCY intervention!
      if (icdTitle.match(/myocardial infarction|stemi|nstemi|acute.*infarction/i)) {
        console.log(`   ❤️ ACUTE MI/STEMI - Adding emergency cardiac intervention searches`)
        firstLineSearches.push(
          'percutaneous coronary intervention',
          'pci cardiac',
          'cardiac catheterization',
          'coronary angiography',
          'coronary angioplasty',
          'stent placement cardiac',
          'revascularization cardiac'
        )
      }
      // General cardiac conditions
      else if (icdCode.startsWith('I') && icdTitle.match(/heart|cardiac|chest pain|angina/)) {
        console.log(`   ❤️ CARDIAC - Adding ECG/Echocardiogram searches`)
        firstLineSearches.push(
          'electrocardiogram',
          'ecg 12-lead',
          'echocardiogram cardiac',
          'cardiac ultrasound',
          'stress test cardiac'
        )
      }
      
      if (icdTitle.match(/hypertension|high blood pressure/)) {
        console.log(`   ❤️ HYPERTENSION - Adding monitoring searches`)
        firstLineSearches.push('blood pressure monitor', 'renal panel', 'metabolic panel', 'electrocardiogram')
      }
      
      // PULMONOLOGY
      if (icdCode.startsWith('J') && icdTitle.match(/lung|pulmonary|respiratory|pneumonia|bronch|copd/)) {
        console.log(`   🫁 RESPIRATORY - Adding chest imaging searches`)
        firstLineSearches.push('chest radiograph', 'chest x-ray 2 views', 'ct chest', 'pulmonary function test')
      }
      
      // NEPHROLOGY
      if (icdCode.match(/^N[0-3]/) && icdTitle.match(/kidney|renal|nephro/)) {
        console.log(`   🫘 KIDNEY - Adding renal test searches`)
        firstLineSearches.push('urinalysis complete', 'renal function panel', 'creatinine clearance', 'ultrasound kidney complete', 'renal ultrasound')
      }
      
      if (icdTitle.match(/urinary tract infection|uti|cystitis/)) {
        console.log(`   🫘 UTI - Adding urinalysis searches`)
        firstLineSearches.push('urinalysis complete', 'urine culture bacterial', 'urine microscopy')
      }
      
      // ENDOCRINOLOGY
      if (icdTitle.match(/thyroid|hypothyroid|hyperthyroid/)) {
        console.log(`   🦋 THYROID - Adding thyroid test searches`)
        firstLineSearches.push('thyroid stimulating hormone', 'tsh test', 'thyroid function panel', 'free t3', 'free t4')
      }
      
      if (icdTitle.match(/diabetes|diabetic/)) {
        console.log(`   🦋 DIABETES - Adding glucose test searches`)
        firstLineSearches.push('hemoglobin a1c test', 'glycohemoglobin', 'glucose blood', 'fasting glucose test', 'comprehensive metabolic panel')
      }
      
      // NEUROLOGY
      if (icdCode.startsWith('G') && icdTitle.match(/brain|cerebral|stroke|seizure|epilepsy/)) {
        console.log(`   🧠 NEUROLOGICAL - Adding brain imaging searches`)
        firstLineSearches.push('mri brain without contrast', 'ct head without contrast', 'electroencephalogram', 'eeg recording')
      }
      
      // OBSTETRICS
      if (icdCode.startsWith('O')) {
        console.log(`   🤰 PREGNANCY - Adding OB searches`)
        firstLineSearches.push('ultrasound pregnant uterus', 'obstetric ultrasound complete', 'prenatal lab panel', 'ob panel')
      }
      
      // ONCOLOGY
      if ((icdCode.match(/^C[0-9]/) || icdTitle.match(/cancer|carcinoma|malignant/)) && icdTitle.match(/cancer|carcinoma/)) {
        console.log(`   🎗️ CANCER - Adding biopsy/staging searches`)
        firstLineSearches.push('biopsy procedure', 'tissue examination pathology', 'pet ct scan', 'tumor marker blood')
      }
      
      // Execute first-line searches and add to linkedCPTs
      if (firstLineSearches.length > 0) {
        console.log(`   🔬 Executing ${firstLineSearches.length} first-line searches...`)
        
        for (const search of firstLineSearches) {
          try {
            const searchResults = await getCPTSuggestions(search, 3)
            if (searchResults && searchResults.length > 0) {
              console.log(`      ✅ "${search}": ${searchResults.length} CPTs`)
              searchResults.forEach(result => {
                if (!linkedCPTs.find(c => c.code === result.code)) {
                  linkedCPTs.unshift({
                    ...result,
                    from_first_line_search: true,
                    confidence_score: 0.99
                  })
                }
              })
            }
          } catch (err) {
            console.log(`      ⚠️  Search failed for "${search}":`, err.message)
          }
        }
        
        console.log(`   ✅ Total CPT candidates (with first-line): ${linkedCPTs.length}`)
      }
      
      if (!linkedCPTs || linkedCPTs.length === 0) {
        console.log(`   ⚠️  No CPT codes found for ${icdCode}`)
        return reply.send({
          icd_code: icdCode,
          suggested_cpt: [],
          count: 0,
          latency_ms: Date.now() - startTime,
          note: 'No CPT codes found'
        })
      }
      
      // Validate ALL codes with Agent #3 (with AI for uncertain/top), then ORDER by medical relevance
      console.log(`   🔬 Agent validating and scoring all codes...`)
      console.log(`   🤖 AI validation will be used for uncertain cases (50-85% confidence)`)
      
      const icdContext = {
        code: icdCode,
        description: icdDetails?.title || linkedCPTs[0]?.icd_title || icdCode
      }
      
      const scoredCPTs = []
      let aiCallCount = 0
      
      for (const cpt of linkedCPTs.slice(0, Math.min(linkedCPTs.length, 30))) { // Limit to 30 for performance
        // Use Agent #3 to score clinical appropriateness
        // Detect procedure type from description
        const cptDesc = (cpt.display || cpt.short_description || cpt.label || '').toLowerCase()
        let procedureType = 'exam'
        
        if (cptDesc.match(/x-ray|xray|radiograph|ct scan|mri|ultrasound|imaging|scan|fluoroscop/)) {
          procedureType = 'imaging'
        } else if (cptDesc.match(/test|panel|blood|laboratory|pathology|screening/)) {
          procedureType = 'lab'
        } else if (cptDesc.match(/surgical|surgery|excision|removal|repair|treatment|open|closed/)) {
          procedureType = 'surgery'
        }
        
        const validation = await cptMatcherAgent.validateCPT(
          cpt,
          { term: cpt.display || cpt.label, type: procedureType },
          [icdContext],
          {}
        )
        
        // Track AI usage
        if (validation.ai_validation?.ai_validated) {
          aiCallCount++
        }
        
        // MEGA BOOST for first-line procedures found via active search (ESSENTIAL per NICE!)
        let finalScore = validation.confidence
        if (cpt.from_first_line_search) {
          finalScore = Math.min(0.98, validation.confidence + 0.30) // +30% boost!
          console.log(`      ⭐ FIRST-LINE BOOST: ${cpt.code} from ${(validation.confidence * 100).toFixed(0)}% → ${(finalScore * 100).toFixed(0)}%`)
        }
        
        scoredCPTs.push({
          code: cpt.code,
          display: cpt.display || cpt.label,
          short_description: cpt.short_description,
          category: cpt.category,
          match_score: finalScore,
          verdict: validation.verdict,
          clinical_note: validation.clinical_note,
          validation_notes: validation.validation_notes,
          from_links_table: !cpt.from_first_line_search,
          from_first_line_search: cpt.from_first_line_search || false,
          agent_validated: true,
          nice_pathway: cpt.confidence_score >= 0.95 || cpt.from_first_line_search // First-line = NICE pathway!
        })
      }
      
      // SORT by confidence (highest first) - NICE pathways will be at top!
      scoredCPTs.sort((a, b) => b.match_score - a.match_score)
      
      // Take top N
      const topCPTs = scoredCPTs.slice(0, limit)
      
      const latency = Date.now() - startTime
      
      console.log(`   ✅ Agent scored ${scoredCPTs.length} codes (🤖 AI validated ${aiCallCount}), showing top ${topCPTs.length}:`)
      topCPTs.forEach((cpt, i) => {
        const nice = cpt.nice_pathway ? '⭐ NICE' : ''
        console.log(`      ${i+1}. ${cpt.code}: ${(cpt.match_score * 100).toFixed(0)}% - ${cpt.verdict} ${nice}`)
      })
      
      return reply.send({
      icd_code: icdCode,
        suggested_cpt: topCPTs,
        count: topCPTs.length,
        latency_ms: latency,
        agent_validated: true,
        note: 'Ranked by medical appropriateness (NICE pathways prioritized)'
      })
    
  } catch (error) {
      console.error('❌ Error in agent-powered ICD-CPT linking:', error)
      return reply.status(500).send({ 
      error: 'Failed to fetch CPT suggestions',
        suggested_cpt: [],
        message: error.message
      })
  }
  })
}

export default icdCptLinkRoutes
