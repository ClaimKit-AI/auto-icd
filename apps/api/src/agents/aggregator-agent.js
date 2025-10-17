// Final Aggregator Agent - Phase 2 Agent #4
// Combines outputs from all agents with weighted scoring
// Generates final rankings and clinical reasoning

/**
 * Final Aggregator Agent
 * 
 * Combines outputs from:
 * - Agent #1: Medical NLP (entity extraction)
 * - Agent #2: ICD Verifier (code validation)
 * - Agent #3: CPT Matcher (procedure matching)
 * 
 * Produces:
 * - Weighted final scores
 * - Ranked suggestions
 * - Clinical reasoning
 * - Confidence calibration
 */
export class AggregatorAgent {
  constructor() {
    this.agentId = 'aggregator-agent'
  }
  
  /**
   * Aggregate and rank all detected codes
   * 
   * @param {Array} codes - All codes from previous agents
   * @param {Object} entities - Extracted entities from NLP
   * @param {Object} patientContext - Patient context
   * @returns {Object} Final aggregated results with reasoning
   */
  aggregate(codes, entities, patientContext) {
    const startTime = Date.now()
    
    try {
      console.log(`🎯 [${this.agentId}] Aggregating ${codes.length} codes`)
      
      // Separate ICD and CPT codes
      const icdCodes = codes.filter(c => c.type === 'ICD')
      const cptCodes = codes.filter(c => c.type === 'CPT')
      
      console.log(`   ${icdCodes.length} ICD codes, ${cptCodes.length} CPT codes`)
      
      // Calculate final scores for each code
      const rankedCodes = codes.map(code => {
        const finalScore = this.calculateFinalScore(code, codes, patientContext)
        
        return {
          ...code,
          final_score: finalScore.score,
          score_breakdown: finalScore.breakdown,
          ranking_factors: finalScore.factors,
          clinical_reasoning: this.generateReasoning(code, entities, finalScore)
        }
      })
      
      // Sort by final score (highest first)
      rankedCodes.sort((a, b) => b.final_score - a.final_score)
      
      // Generate overall clinical summary
      const clinicalSummary = this.generateClinicalSummary(rankedCodes, entities, patientContext)
      
      // Calculate quality metrics
      const metrics = this.calculateMetrics(rankedCodes)
      
      const latency = Date.now() - startTime
      
      console.log(`✅ [${this.agentId}] Aggregation complete in ${latency}ms`)
      console.log(`   Average final score: ${(metrics.avg_score * 100).toFixed(1)}%`)
      console.log(`   High confidence codes (>90%): ${metrics.high_confidence_count}`)
      
      return {
        success: true,
        agentId: this.agentId,
        ranked_codes: rankedCodes,
        clinical_summary: clinicalSummary,
        metrics: metrics,
        latency: latency
      }
      
    } catch (error) {
      console.error(`❌ [${this.agentId}] Error:`, error.message)
      
      return {
        success: false,
        agentId: this.agentId,
        error: error.message,
        latency: Date.now() - startTime
      }
    }
  }
  
  /**
   * Calculate weighted final score
   * 
   * Formula:
   * FinalScore = (Extraction × 0.25) + (Verification × 0.35) + 
   *              (Clinical Match × 0.30) + (Quality × 0.10)
   */
  calculateFinalScore(code, allCodes, patientContext) {
    const weights = {
      extraction: 0.25,  // How confident was the NLP extraction?
      verification: 0.35, // How well did it verify?
      clinical: 0.30,    // How clinically appropriate?
      quality: 0.10      // Database quality (embeddings, metadata)
    }
    
    // Component scores
    const extractionScore = code.confidence || 0.85 // From NLP agent
    const verificationScore = code.confidence || 0.85 // From verifier/matcher
    
    // Clinical match score (ICD-CPT coherence)
    let clinicalScore = 0.70 // Base
    if (code.type === 'CPT' && allCodes.some(c => c.type === 'ICD')) {
      // CPT with related ICD = bonus
      clinicalScore += 0.20
    }
    if (code.verdict?.includes('APPROVE')) clinicalScore += 0.10
    
    // Quality score
    let qualityScore = 0.60 // Base
    if (code.verified || code.validated_by) qualityScore += 0.20
    if (code.verification_data?.has_embedding) qualityScore += 0.20
    
    // Calculate weighted final score
    const finalScore = 
      (extractionScore * weights.extraction) +
      (verificationScore * weights.verification) +
      (clinicalScore * weights.clinical) +
      (qualityScore * weights.quality)
    
    return {
      score: Math.min(finalScore, 0.98), // Cap at 98%
      breakdown: {
        extraction: extractionScore,
        verification: verificationScore,
        clinical: clinicalScore,
        quality: qualityScore
      },
      factors: [
        `Extraction confidence: ${(extractionScore * 100).toFixed(1)}%`,
        `Verification: ${(verificationScore * 100).toFixed(1)}%`,
        `Clinical match: ${(clinicalScore * 100).toFixed(1)}%`,
        `Database quality: ${(qualityScore * 100).toFixed(1)}%`
      ]
    }
  }
  
  /**
   * Generate clinical reasoning for a code
   */
  generateReasoning(code, entities, scoreData) {
    const reasoning = []
    
    // Why was this code extracted?
    if (code.trigger) {
      reasoning.push(`Extracted from clinical term: "${code.trigger}"`)
    }
    
    // Verification notes
    if (code.verdict) {
      reasoning.push(`Verification: ${code.verdict}`)
    }
    
    // Clinical appropriateness
    if (code.clinical_note) {
      reasoning.push(code.clinical_note)
    }
    
    // Suggestions
    if (code.suggestions && code.suggestions.length > 0) {
      const suggestion = code.suggestions[0]
      reasoning.push(`Suggestion: ${suggestion.note}`)
    }
    
    // Final confidence
    reasoning.push(`Final confidence: ${(scoreData.score * 100).toFixed(1)}%`)
    
    return reasoning.join(' • ')
  }
  
  /**
   * Generate overall clinical summary
   */
  generateClinicalSummary(rankedCodes, entities, patientContext) {
    const icdCodes = rankedCodes.filter(c => c.type === 'ICD')
    const cptCodes = rankedCodes.filter(c => c.type === 'CPT')
    
    const summary = {
      patient_context: patientContext,
      diagnoses_count: icdCodes.length,
      procedures_count: cptCodes.length,
      top_diagnosis: icdCodes[0] ? {
        code: icdCodes[0].code,
        description: icdCodes[0].description,
        confidence: icdCodes[0].final_score
      } : null,
      recommended_procedures: cptCodes.map(cpt => ({
        code: cpt.code,
        description: cpt.description,
        confidence: cpt.final_score,
        reasoning: cpt.clinical_note
      })),
      clinical_note: this.buildClinicalNote(icdCodes, cptCodes, entities)
    }
    
    return summary
  }
  
  /**
   * Build narrative clinical note
   */
  buildClinicalNote(icdCodes, cptCodes, entities) {
    const notes = []
    
    if (icdCodes.length > 0) {
      const diagnoses = icdCodes.map(c => c.description).join(', ')
      notes.push(`Diagnoses: ${diagnoses}`)
    }
    
    if (cptCodes.length > 0) {
      const procedures = cptCodes.map(c => c.description).join(', ')
      notes.push(`Recommended procedures: ${procedures}`)
    }
    
    if (entities.patient_context) {
      const ctx = entities.patient_context
      if (ctx.gender_mentioned && ctx.gender_mentioned !== 'none') {
        notes.push(`Patient: ${ctx.gender_mentioned}`)
      }
    }
    
    return notes.join('. ') + '.'
  }
  
  /**
   * Calculate quality metrics
   */
  calculateMetrics(rankedCodes) {
    if (rankedCodes.length === 0) {
      return {
        avg_score: 0,
        high_confidence_count: 0,
        medium_confidence_count: 0,
        low_confidence_count: 0
      }
    }
    
    const avgScore = rankedCodes.reduce((sum, c) => sum + c.final_score, 0) / rankedCodes.length
    
    return {
      avg_score: avgScore,
      high_confidence_count: rankedCodes.filter(c => c.final_score >= 0.90).length,
      medium_confidence_count: rankedCodes.filter(c => c.final_score >= 0.70 && c.final_score < 0.90).length,
      low_confidence_count: rankedCodes.filter(c => c.final_score < 0.70).length,
      total_codes: rankedCodes.length
    }
  }
}

/**
 * Singleton instance
 */
export const aggregatorAgent = new AggregatorAgent()

export default aggregatorAgent

