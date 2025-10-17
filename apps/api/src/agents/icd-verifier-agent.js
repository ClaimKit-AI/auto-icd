// ICD Verifier Agent - Phase 2 Agent #2
// Validates ICD codes with CLINICAL COHERENCE (not rigid rejection)
// Universal Medical Validation: Intention > Textual Precision

import { query } from '../database.js'

/**
 * ICD Verifier Agent - Clinical Coherence Validator
 * 
 * Core Principle: Medical coherence over textual precision
 * - Accept clinically related codes (E03.2 ≈ E03.9 both hypothyroidism)
 * - Suggest normalization instead of rejection
 * - Confidence-based verdicts (>0.9 approve, 0.6-0.9 suggest, <0.6 flag)
 * - Cross-specialty reasoning
 */
export class ICDVerifierAgent {
  constructor() {
    this.agentId = 'icd-verifier-agent'
  }
  
  /**
   * Verify ICD code with clinical coherence validation
   * 
   * @param {string} code - ICD code to verify
   * @param {Object} context - Patient context from NLP agent
   * @returns {Object} Verification with suggestions, not rejection
   */
  async verifyCode(code, context = {}) {
    const startTime = Date.now()
    
    try {
      console.log(`🔍 [${this.agentId}] Verifying:`, code)
      
      // Query database
      const result = await query(`
        SELECT 
          code, title, chapter, block, category,
          has_specifiers,
          title_embedding IS NOT NULL as has_embedding,
          synonyms
        FROM icd_codes
        WHERE code = $1
      `, [code])
      
      if (result.rows.length === 0) {
        return {
          success: false,
          valid: false,
          reason: 'Code not in database',
          confidence: 0.0,
          latency: Date.now() - startTime
        }
      }
      
      const icdData = result.rows[0]
      let confidence = 0.7 // Start higher - assume clinical intent
      const suggestions = []
      const validationNotes = []
      
      // ========================================================================
      // CLINICAL COHERENCE CHECKS (Suggest, Don't Reject!)
      // ========================================================================
      
      // Check 1: Pregnancy codes (O-codes) - Suggest general if no pregnancy
      if (code.match(/^O\d/)) {
        if (!context.pregnancy_related && context.gender_mentioned !== 'pregnant') {
          confidence = 0.65 // Medium confidence - clinically questionable
          suggestions.push({
            type: 'normalization',
            reason: 'Pregnancy-specific code without pregnancy context',
            suggested_search: `${icdData.title.replace(/pregnancy|childbirth|puerperium/gi, '').trim()} unspecified`,
            note: 'Consider general code for non-pregnant patient'
          })
          validationNotes.push('⚠️  Pregnancy code - suggest general alternative if not pregnant')
        } else {
          confidence += 0.15
          validationNotes.push('✅ Pregnancy code with pregnancy context')
        }
      }
      
      // Check 2: Gender-specific codes - Suggest if mismatch
      const title = icdData.title.toLowerCase()
      if (title.match(/male prostate|testicular|penis/i) && context.gender_mentioned === 'female') {
        confidence = 0.50
        suggestions.push({
          type: 'gender_mismatch',
          reason: 'Male-specific condition for female patient',
          note: 'Verify patient gender or search female equivalent'
        })
        validationNotes.push('⚠️  Male-specific code - check patient gender')
      } else if (title.match(/female ovarian|uterine|cervical|vaginal|menstrual/i) && context.gender_mentioned === 'male') {
        confidence = 0.50
        suggestions.push({
          type: 'gender_mismatch',
          reason: 'Female-specific condition for male patient',
          note: 'Verify patient gender or search male equivalent'
        })
        validationNotes.push('⚠️  Female-specific code - check patient gender')
      }
      
      // Check 3: Age appropriateness - Suggest if mismatch
      if (title.match(/newborn|infant|congenital|neonatal/i)) {
        if (context.age_mentioned === 'adult' || context.age_mentioned === 'geriatric') {
          confidence -= 0.20
          suggestions.push({
            type: 'age_mismatch',
            reason: 'Pediatric/neonatal code for adult patient',
            note: 'Consider adult-onset equivalent if available'
          })
          validationNotes.push('⚠️  Pediatric code for adult - check appropriateness')
        }
      }
      
      // Check 4: Specificity vs Generality - Hierarchical reasoning
      const moreSpecific = await this.findMoreSpecificCodes(code)
      const lessSpecific = await this.findParentCode(code)
      
      if (moreSpecific.length > 0 && context.anatomical_site !== 'unspecified') {
        // More specific codes exist AND we have context - suggest refinement
        suggestions.push({
          type: 'refinement',
          reason: 'More specific codes available',
          alternatives: moreSpecific.slice(0, 3),
          note: 'Consider more specific code if applicable'
        })
        validationNotes.push(`ℹ️  ${moreSpecific.length} more specific codes available`)
      }
      
      if (lessSpecific && confidence < 0.70) {
        // Current code has issues, parent code might be better
        suggestions.push({
          type: 'normalization',
          reason: 'Consider broader/general code',
          suggested_code: lessSpecific.code,
          suggested_title: lessSpecific.title,
          note: 'More general code may be more appropriate'
        })
        validationNotes.push(`💡 Parent code available: ${lessSpecific.code}`)
      }
      
      // ========================================================================
      // QUALITY CHECKS (Boost confidence, don't penalize)
      // ========================================================================
      
      if (icdData.has_embedding) {
        confidence += 0.10
        validationNotes.push('✅ AI-ready (has embeddings)')
      }
      
      if (icdData.chapter) {
        confidence += 0.05
        validationNotes.push('✅ Classified in chapter')
      }
      
      if (icdData.has_specifiers) {
        validationNotes.push('🔧 Specifiers available for refinement')
      }
      
      // Cap at 0.98 (medical humility)
      confidence = Math.max(0.40, Math.min(confidence, 0.98))
      
      // ========================================================================
      // VERDICT: Confidence-Based (Never Hard Reject)
      // ========================================================================
      
      let verdict
      if (confidence >= 0.90) {
        verdict = 'APPROVE - Clinically coherent'
      } else if (confidence >= 0.60) {
        verdict = 'LIKELY_VALID - Consider suggestions'
      } else {
        verdict = 'QUESTIONABLE - Manual review recommended'
      }
      
      const latency = Date.now() - startTime
      
      console.log(`✅ [${this.agentId}] ${code}: ${(confidence * 100).toFixed(1)}% - ${verdict}`)
      validationNotes.forEach(note => console.log(`   ${note}`))
      if (suggestions.length > 0) {
        console.log(`   💡 ${suggestions.length} suggestion(s)`)
      }
      
      return {
        success: true,
        agentId: this.agentId,
        code: code,
        valid: confidence > 0.40, // Only reject if <40% (clinically nonsensical)
        verdict: verdict,
        confidence: confidence,
        data: {
          title: icdData.title,
          chapter: icdData.chapter,
          has_specifiers: icdData.has_specifiers,
          has_embedding: icdData.has_embedding,
          more_specific_codes: moreSpecific,
          parent_code: lessSpecific,
          validation_notes: validationNotes,
          suggestions: suggestions, // Normalization suggestions
          clinical_note: this.generateClinicalNote(code, icdData, suggestions)
        },
        latency: latency
      }
      
    } catch (error) {
      console.error(`❌ [${this.agentId}] Error:`, error.message)
      
      return {
        success: false,
        valid: false,
        error: error.message,
        confidence: 0.0,
        latency: Date.now() - startTime
      }
    }
  }
  
  /**
   * Generate clinical note for verification
   */
  generateClinicalNote(code, icdData, suggestions) {
    if (suggestions.length === 0) {
      return `Code ${code} is clinically appropriate.`
    }
    
    const notes = [`Code ${code} (${icdData.title}) is clinically valid`]
    
    suggestions.forEach(sug => {
      if (sug.type === 'normalization') {
        notes.push(`Consider ${sug.suggested_code || 'general code'} for better precision`)
      } else if (sug.type === 'refinement') {
        notes.push(`More specific codes available if context permits`)
      }
    })
    
    return notes.join('. ') + '.'
  }
  
  /**
   * Find parent/general code
   */
  async findParentCode(code) {
    try {
      // Remove last character to find parent (E03.2 → E03)
      const parentCode = code.substring(0, code.length - 1)
      
      if (parentCode.length >= 3) {
        const result = await query(`
          SELECT code, title
          FROM icd_codes
          WHERE code = $1
          LIMIT 1
        `, [parentCode])
        
        return result.rows[0] || null
      }
    } catch (err) {
      return null
    }
  }
  
  /**
   * Find more specific child codes
   */
  async findMoreSpecificCodes(code) {
    try {
      const result = await query(`
        SELECT code, title
        FROM icd_codes
        WHERE code LIKE $1 || '%'
          AND code != $1
          AND LENGTH(code) > LENGTH($1)
        LIMIT 5
      `, [code])
      
      return result.rows
    } catch (error) {
      return []
    }
  }
  
  /**
   * Batch verify with clinical coherence
   */
  async verifyBatch(codes, context = {}) {
    console.log(`🔍 [${this.agentId}] Batch verifying ${codes.length} codes`)
    
    const results = await Promise.all(
      codes.map(code => this.verifyCode(code, context))
    )
    
    const approvedCount = results.filter(r => r.confidence >= 0.90).length
    const likelyValidCount = results.filter(r => r.confidence >= 0.60 && r.confidence < 0.90).length
    
    console.log(`✅ [${this.agentId}] Batch complete:`)
    console.log(`   ${approvedCount} approved (>90%)`)
    console.log(`   ${likelyValidCount} likely valid (60-90%)`)
    console.log(`   ${results.length - approvedCount - likelyValidCount} questionable (<60%)`)
    
    return results
  }
}

/**
 * Singleton instance
 */
export const icdVerifierAgent = new ICDVerifierAgent()

export default icdVerifierAgent
