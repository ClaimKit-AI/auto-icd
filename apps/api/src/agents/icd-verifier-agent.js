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
   * Verify a single ICD code
   * 
   * @param {string} code - ICD code to verify
   * @returns {Object} Verification result with confidence
   */
  async verifyCode(code) {
    const startTime = Date.now()
    
    try {
      console.log(`🔍 [${this.agentId}] Verifying ICD code:`, code)
      
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
      
      // Confidence boosters
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
        confidence += 0.05
        validationChecks.push('ℹ️  Has specifiers available')
      }
      
      // Check for more specific child codes
      const childCodes = await this.findMoreSpecificCodes(code)
      if (childCodes.length > 0) {
        confidence -= 0.10 // Reduce if more specific codes exist
        validationChecks.push(`⚠️  ${childCodes.length} more specific codes available`)
      } else {
        confidence += 0.20 // Boost if this is most specific
        validationChecks.push('✅ Most specific code available')
      }
      
      // Cap confidence at 0.98 (never 100% certain in medicine)
      confidence = Math.min(confidence, 0.98)
      
      const latency = Date.now() - startTime
      
      console.log(`✅ [${this.agentId}] Verified ${code} - Confidence: ${(confidence * 100).toFixed(1)}%`)
      validationChecks.forEach(check => console.log(`   ${check}`))
      
      return {
        success: true,
        agentId: this.agentId,
        code: code,
        valid: true,
        confidence: confidence,
        data: {
          title: icdData.title,
          chapter: icdData.chapter,
          has_specifiers: icdData.has_specifiers,
          has_embedding: icdData.has_embedding,
          more_specific_codes: childCodes,
          validation_checks: validationChecks
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

