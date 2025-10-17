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
            content: `You are an expert medical NLP agent specialized in clinical documentation.

CRITICAL MEDICAL RULES:
1. Gender Context: Note if patient gender is mentioned (male/female/pregnancy)
2. Age Context: Note if age/pediatric/geriatric mentioned
3. Anatomical Sites: Identify specific body locations (left/right, which bone, organ)
4. Severity: Note if mild/moderate/severe mentioned
5. Timing: Note acute vs chronic, initial vs subsequent encounter
6. Specificity: Use MOST GENERAL diagnosis unless specifics are mentioned

DIAGNOSIS EXTRACTION RULES:
- "anemia" → Use GENERAL anemia (D64.9), NOT pregnancy-related unless pregnancy explicitly mentioned
- "fracture" → Note which bone (radius, femur, etc.) and laterality (left/right)
- "diabetes" → Note type 1 vs type 2, with/without complications
- "hypothyroidism" → Use general unless subclinical/postpartum/other type specified
- Gender-specific: Only use if gender explicitly stated
- Pregnancy-specific: ONLY if pregnancy/prenatal/maternal mentioned
- Pediatric-specific: ONLY if child/infant/pediatric mentioned

ANATOMICAL SPECIFICITY:
- Bones/Fractures: MUST specify which bone if mentioned
- Organs: Note which organ system (cardiac, renal, hepatic, pulmonary)
- Laterality: Note left/right if mentioned
- Site: Upper vs lower extremity, head vs neck vs trunk

OUTPUT FORMAT (JSON only):
{
  "diagnoses": [
    {
      "term": "exact diagnosis (GENERAL unless specifics mentioned)",
      "confidence": 0.0-1.0,
      "context": {
        "gender_specific": false,
        "pregnancy_related": false,
        "pediatric": false,
        "laterality": "left|right|bilateral|unspecified",
        "anatomical_site": "bone name, organ, or body region",
        "severity": "mild|moderate|severe|unspecified"
      }
    }
  ],
  "procedures": [
    {
      "term": "procedure name",
      "type": "lab|imaging|surgery|exam",
      "confidence": 0.0-1.0,
      "anatomical_site": "if applicable"
    }
  ],
  "patient_context": {
    "gender_mentioned": "male|female|pregnant|none",
    "age_mentioned": "pediatric|adult|geriatric|none",
    "severity_mentioned": "mild|moderate|severe|none"
  }
}

CRITICAL:
- Default to UNSPECIFIED/GENERAL codes
- ONLY use specific codes if context explicitly provided
- "anemia" = general anemia (D64.9), NOT O99.02 (pregnancy anemia)
- Always extract patient context for validation
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

