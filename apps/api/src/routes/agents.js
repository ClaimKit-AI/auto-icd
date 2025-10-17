// Agent API Routes
// Provides access to intelligent agents for medical processing

import { medicalNLPAgent } from '../agents/medical-nlp-agent.js'
import { icdVerifierAgent } from '../agents/icd-verifier-agent.js'
import { getICDSuggestions, getCPTSuggestions } from '../database.js'

/**
 * Register agent routes
 */
export async function agentRoutes(fastify, options) {
  
  /**
   * POST /api/agents/extract-codes
   * Uses Medical NLP Agent to extract and code medical text
   * 
   * Body: { text: "Patient has diabetes..." }
   * Returns: { icd_codes: [...], cpt_codes: [...], entities: {...} }
   */
  fastify.post('/extract-codes', async (request, reply) => {
    const startTime = Date.now()
    
    try {
      const { text } = request.body
      
      if (!text || typeof text !== 'string') {
        return reply.status(400).send({
          error: 'Text field required',
          example: { text: 'Patient has diabetes' }
        })
      }
      
      console.log('🤖 Agent processing request:', text)
      
      // STEP 1: Use Medical NLP Agent to extract entities
      const extraction = await medicalNLPAgent.extractEntities(text)
      
      if (!extraction.success) {
        return reply.status(500).send({
          error: 'Agent extraction failed',
          message: extraction.error
        })
      }
      
      const entities = extraction.data
      const foundCodes = []
      
      // STEP 2: Map extracted diagnoses to ICD codes
      const icdCodes = []
      if (entities.diagnoses && entities.diagnoses.length > 0) {
        console.log('🏥 Mapping diagnoses to ICD codes...')
        
        for (const diagnosis of entities.diagnoses) {
          try {
            const icdResults = await getICDSuggestions(diagnosis.term, 1)
            
            if (icdResults && icdResults.length > 0) {
              icdCodes.push({
                code: icdResults[0].code,
                type: 'ICD',
                description: icdResults[0].title,
                trigger: diagnosis.term,
                confidence: diagnosis.confidence,
                extracted_by: 'medical-nlp-agent'
              })
              
              console.log(`  ✅ ${diagnosis.term} → ${icdResults[0].code}`)
            }
          } catch (err) {
            console.error(`  ❌ Error mapping ${diagnosis.term}:`, err.message)
          }
        }
      }
      
      // STEP 2.5: VERIFY ICD codes with Agent #2
      if (icdCodes.length > 0) {
        console.log('🔍 Verifying ICD codes with ICD Verifier Agent...')
        
        for (const icdCode of icdCodes) {
          const verification = await icdVerifierAgent.verifyCode(icdCode.code)
          
          if (verification.valid) {
            // Adjust confidence based on verification
            const finalConfidence = (icdCode.confidence * 0.6) + (verification.confidence * 0.4)
            
            foundCodes.push({
              ...icdCode,
              confidence: finalConfidence,
              verified: true,
              verification_data: {
                has_embedding: verification.data.has_embedding,
                has_specifiers: verification.data.has_specifiers,
                more_specific_codes: verification.data.more_specific_codes.length,
                validation_checks: verification.data.validation_checks
              }
            })
            
            console.log(`  ✅ Verified ${icdCode.code} - Final confidence: ${(finalConfidence * 100).toFixed(1)}%`)
          } else {
            console.log(`  ❌ ${icdCode.code} failed verification: ${verification.reason}`)
          }
        }
      }
      
      // STEP 3: Map extracted procedures to CPT codes
      if (entities.procedures && entities.procedures.length > 0) {
        console.log('💊 Mapping procedures to CPT codes...')
        
        for (const procedure of entities.procedures) {
          try {
            const cptResults = await getCPTSuggestions(procedure.term, 1)
            
            if (cptResults && cptResults.length > 0) {
              foundCodes.push({
                code: cptResults[0].code,
                type: 'CPT',
                description: cptResults[0].display || cptResults[0].short_description,
                trigger: procedure.term,
                confidence: procedure.confidence,
                procedure_type: procedure.type,
                extracted_by: 'medical-nlp-agent'
              })
              
              console.log(`  ✅ ${procedure.term} → ${cptResults[0].code}`)
            }
          } catch (err) {
            console.error(`  ❌ Error mapping ${procedure.term}:`, err.message)
          }
        }
      }
      
      const totalLatency = Date.now() - startTime
      
      console.log(`🎉 Agent completed in ${totalLatency}ms, found ${foundCodes.length} codes`)
      
      return reply.send({
        success: true,
        codes: foundCodes,
        entities: entities,
        agent_metadata: {
          agents_used: ['medical-nlp-agent', 'icd-verifier-agent'],
          nlp_agent_latency: extraction.latency,
          total_latency: totalLatency,
          cost: extraction.cost,
          codes_extracted: foundCodes.length,
          verified_count: foundCodes.filter(c => c.verified).length
        },
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('❌ Agent route error:', error)
      
      return reply.status(500).send({
        error: 'Agent processing failed',
        message: error.message,
        latency_ms: Date.now() - startTime
      })
    }
  })
}

export default agentRoutes

