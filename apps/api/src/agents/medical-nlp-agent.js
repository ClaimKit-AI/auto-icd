// Medical NLP Agent - Phase 2 Agent #1
// Extracts medical entities from transcribed text using GPT-4
// Understands context and identifies diagnoses, procedures, and symptoms

import OpenAI from 'openai'

// Initialize OpenAI client for GPT-4
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Medical Entity Extraction Agent
 * 
 * Uses GPT-4 to intelligently extract medical information from natural language
 * Returns structured data: diagnoses, procedures, symptoms
 */
export class MedicalNLPAgent {
  constructor() {
    this.agentId = 'medical-nlp-agent'
    this.model = 'gpt-4o-mini' // Fast and cost-effective
  }
  
  /**
   * Extract medical entities from transcribed text
   * 
   * @param {string} text - Transcribed medical text
   * @returns {Object} Structured medical entities
   */
  async extractEntities(text) {
    const startTime = Date.now()
    
    try {
      console.log(`🤖 [${this.agentId}] Processing:`, text)
      
      // Call GPT-4 with specialized medical extraction prompt
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: `You are a medical NLP agent that extracts structured information from clinical notes.

Your task:
1. Identify DIAGNOSES (conditions, diseases)
2. Identify PROCEDURES (tests, scans, surgeries)
3. Extract key medical terms

Output ONLY valid JSON in this exact format:
{
  "diagnoses": [
    {"term": "exact medical term", "confidence": 0.0-1.0}
  ],
  "procedures": [
    {"term": "exact procedure name", "type": "lab|imaging|surgery", "confidence": 0.0-1.0}
  ],
  "symptoms": [
    "symptom1", "symptom2"
  ]
}

Rules:
- Use standard medical terminology
- High confidence (0.9+) for explicit mentions
- Medium confidence (0.6-0.8) for implied conditions
- Return empty arrays if nothing found
- NO explanations, ONLY JSON`
          },
          {
            role: 'user',
            content: `Extract medical entities from this clinical note:\n\n"${text}"`
          }
        ],
        temperature: 0.1, // Low temperature for consistent extraction
        max_tokens: 500,
        response_format: { type: 'json_object' } // Force JSON response
      })
      
      const result = JSON.parse(response.choices[0].message.content)
      const latency = Date.now() - startTime
      
      console.log(`✅ [${this.agentId}] Extracted entities in ${latency}ms:`)
      console.log('  Diagnoses:', result.diagnoses?.length || 0)
      console.log('  Procedures:', result.procedures?.length || 0)
      console.log('  Symptoms:', result.symptoms?.length || 0)
      
      return {
        success: true,
        agentId: this.agentId,
        data: result,
        latency,
        cost: this.estimateCost(text, result)
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
   * Estimate cost of this agent call
   */
  estimateCost(inputText, result) {
    // GPT-4o-mini: $0.150 per 1M input tokens, $0.600 per 1M output tokens
    const inputTokens = Math.ceil(inputText.length / 4)
    const outputTokens = Math.ceil(JSON.stringify(result).length / 4)
    
    const inputCost = (inputTokens / 1_000_000) * 0.150
    const outputCost = (outputTokens / 1_000_000) * 0.600
    
    return (inputCost + outputCost).toFixed(6)
  }
}

/**
 * Singleton instance for reuse
 */
export const medicalNLPAgent = new MedicalNLPAgent()

export default medicalNLPAgent

