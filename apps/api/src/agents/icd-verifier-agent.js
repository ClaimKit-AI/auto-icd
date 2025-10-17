// ICD Verifier Agent - Phase 2 Agent #2
// Validates ICD codes extracted by Medical NLP Agent
// Checks existence, specificity, and provides confidence scoring

import { query } from '../database.js'

/**
 * ICD Verifier Agent
 * 
 * Validates ICD codes and checks for:
 * - Code exists in database
 * - Code is current/valid
 * - More specific codes available
 * - Has embeddings (AI-ready)
 * - Returns confidence score
 */
export class ICDVerifierAgent {
  constructor() {
    this.agentId = 'icd-verifier-agent'
  }
  
  /**
   * Verify a single ICD code with medical context validation
   * 
   * @param {string} code - ICD code to verify
   * @param {Object} context - Patient context from NLP agent
   * @returns {Object} Verification result with confidence
   */
  async verifyCode(code, context = {}) {
    const startTime = Date.now()
    
    try {
      console.log(`🔍 [${this.agentId}] Verifying ICD code:`, code, 'with context:', context)
      
      // Query database for this code
      const result = await query(`
        SELECT 
          code,
          title,
          chapter,
          block,
          category,
          has_specifiers,
          title_embedding IS NOT NULL as has_embedding,
          synonyms
        FROM icd_codes
        WHERE code = $1
      `, [code])
      
      if (result.rows.length === 0) {
        console.log(`❌ [${this.agentId}] Code ${code} not found in database`)
        
        return {
          success: false,
          agentId: this.agentId,
          code: code,
          valid: false,
          reason: 'Code not found in database',
          confidence: 0.0,
          latency: Date.now() - startTime
        }
      }
      
      const icdData = result.rows[0]
      let confidence = 0.5 // Base confidence
      const validationChecks = []
      const warnings = []
      
      // MEDICAL CONTEXT VALIDATION (Critical for safety!)
      
      // Check 1: Pregnancy-specific codes (O-codes)
      if (code.match(/^O\d/)) {
        if (!context.pregnancy_related && context.gender_mentioned !== 'pregnant') {
          confidence -= 0.40 // Major penalty
          warnings.push('⚠️  PREGNANCY code but patient not stated as pregnant')
          validationChecks.push('❌ May be incorrect - consider general code instead')
        } else {
          validationChecks.push('✅ Pregnancy code with pregnancy context')
        }
      }
      
      // Check 2: Gender-specific codes
      const isMaleOnlyCode = icdData.title?.match(/male|prostate|testicular|penis/i)
      const isFemaleOnlyCode = icdData.title?.match(/female|ovarian|uterine|cervical|vaginal|menstrual/i)
      
      if (isMaleOnlyCode && context.gender_mentioned === 'female') {
        confidence -= 0.50
        warnings.push('❌ MALE-SPECIFIC code for female patient')
      }
      if (isFemaleOnlyCode && context.gender_mentioned === 'male') {
        confidence -= 0.50
        warnings.push('❌ FEMALE-SPECIFIC code for male patient')
      }
      
      // Check 3: Pediatric vs Adult codes
      if (icdData.title?.match(/newborn|infant|congenital/i)) {
        if (context.age_mentioned === 'adult' || context.age_mentioned === 'geriatric') {
          confidence -= 0.30
          warnings.push('⚠️  Pediatric/neonatal code for adult patient')
        }
      }
      
      // Check 4: Anatomical site requirements
      if (code.match(/^[SM]\d/)) { // Injury/Musculoskeletal codes
        if (context.anatomical_site === 'unspecified' || !context.anatomical_site) {
          confidence -= 0.15
          warnings.push('⚠️  Code requires specific anatomical site')
          validationChecks.push('🔧 Specifiers may be needed')
        }
      }
      
      // Database quality checks
      if (icdData.has_embedding) {
        confidence += 0.15
        validationChecks.push('✅ Has AI embedding')
      } else {
        validationChecks.push('⚠️  No AI embedding')
      }
      
      if (icdData.chapter && icdData.chapter.length > 0) {
        confidence += 0.10
        validationChecks.push('✅ Has chapter classification')
      }
      
      if (icdData.has_specifiers) {
        validationChecks.push('🔧 Has specifiers - code may need refinement')
      }
      
      // Check for more specific child codes
      const childCodes = await this.findMoreSpecificCodes(code)
      if (childCodes.length > 0) {
        confidence -= 0.10
        validationChecks.push(`⚠️  ${childCodes.length} more specific codes available`)
        warnings.push(`Consider more specific: ${childCodes.slice(0, 3).map(c => c.code).join(', ')}`)
      } else {
        confidence += 0.20
        validationChecks.push('✅ Most specific code in category')
      }
      
      // Cap confidence at 0.98 (never 100% certain in medicine)
      confidence = Math.max(0.0, Math.min(confidence, 0.98))
      
      const latency = Date.now() - startTime
      
      console.log(`✅ [${this.agentId}] Verified ${code} - Confidence: ${(confidence * 100).toFixed(1)}%`)
      validationChecks.forEach(check => console.log(`   ${check}`))
      if (warnings.length > 0) {
        console.log(`⚠️  Medical warnings:`)
        warnings.forEach(w => console.log(`   ${w}`))
      }
      
      return {
        success: true,
        agentId: this.agentId,
        code: code,
        valid: confidence > 0.3, // Only invalid if confidence drops below 30%
        confidence: confidence,
        data: {
          title: icdData.title,
          chapter: icdData.chapter,
          has_specifiers: icdData.has_specifiers,
          has_embedding: icdData.has_embedding,
          more_specific_codes: childCodes,
          validation_checks: validationChecks,
          warnings: warnings // MEDICAL WARNINGS (pregnancy, gender, age mismatches)
        },
        latency: latency
      }
      
    } catch (error) {
      console.error(`❌ [${this.agentId}] Error:`, error.message)
      
      return {
        success: false,
        agentId: this.agentId,
        code: code,
        valid: false,
        error: error.message,
        confidence: 0.0,
        latency: Date.now() - startTime
      }
    }
  }
  
  /**
   * Find more specific child codes
   * Example: E03 (Hypothyroidism) has children E03.0, E03.1, E03.2, etc.
   */
  async findMoreSpecificCodes(code) {
    try {
      // Look for codes that start with this code + additional digits
      const result = await query(`
        SELECT code, title
        FROM icd_codes
        WHERE code LIKE $1 || '%'
          AND code != $1
          AND LENGTH(code) > LENGTH($1)
        LIMIT 10
      `, [code])
      
      return result.rows.map(row => ({
        code: row.code,
        title: row.title
      }))
      
    } catch (error) {
      console.error('Error finding child codes:', error)
      return []
    }
  }
  
  /**
   * Batch verify multiple ICD codes
   * 
   * @param {Array<string>} codes - Array of ICD codes to verify
   * @returns {Array<Object>} Array of verification results
   */
  async verifyBatch(codes) {
    console.log(`🔍 [${this.agentId}] Batch verifying ${codes.length} codes`)
    
    const results = await Promise.all(
      codes.map(code => this.verifyCode(code))
    )
    
    const validCount = results.filter(r => r.valid).length
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    
    console.log(`✅ [${this.agentId}] Batch complete: ${validCount}/${codes.length} valid, avg confidence: ${(avgConfidence * 100).toFixed(1)}%`)
    
    return results
  }
}

/**
 * Singleton instance
 */
export const icdVerifierAgent = new ICDVerifierAgent()

export default icdVerifierAgent

