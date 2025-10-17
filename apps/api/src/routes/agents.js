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
      
      // STEP 2: Map extracted diagnoses to ICD codes (GET MULTIPLE CANDIDATES!)
      const icdCodes = []
      if (entities.diagnoses && entities.diagnoses.length > 0) {
        console.log('🏥 Mapping diagnoses to ICD codes...')
        
        for (const diagnosis of entities.diagnoses) {
          try {
            // Get TOP 5 candidates from AI search (not just 1!)
            const icdResults = await getICDSuggestions(diagnosis.term, 5)
            
            if (icdResults && icdResults.length > 0) {
              console.log(`  📊 Found ${icdResults.length} candidates for "${diagnosis.term}":`)
              icdResults.forEach((r, i) => console.log(`     ${i+1}. ${r.code} - ${r.title}`))
              
              // Add ALL candidates for verification (Agent #2 will pick best one)
              for (const icdResult of icdResults) {
                icdCodes.push({
                  code: icdResult.code,
                  type: 'ICD',
                  description: icdResult.title,
                  trigger: diagnosis.term,
                  confidence: diagnosis.confidence,
                  context: diagnosis.context || {},
                  extracted_by: 'medical-nlp-agent'
                })
              }
            }
          } catch (err) {
            console.error(`  ❌ Error mapping ${diagnosis.term}:`, err.message)
          }
        }
      }
      
      // STEP 2.5: VERIFY ICD codes with Agent #2 (picks BEST from candidates!)
      if (icdCodes.length > 0) {
        console.log(`🔍 Verifying ${icdCodes.length} ICD candidates with ICD Verifier Agent...`)
        
        // Get patient context from NLP agent
        const patientContext = entities.patient_context || {}
        
        // Group candidates by diagnosis term
        const candidatesByDiagnosis = {}
        icdCodes.forEach(icdCode => {
          if (!candidatesByDiagnosis[icdCode.trigger]) {
            candidatesByDiagnosis[icdCode.trigger] = []
          }
          candidatesByDiagnosis[icdCode.trigger].push(icdCode)
        })
        
        // For each diagnosis, verify ALL candidates and pick BEST one
        for (const [diagnosisTerm, candidates] of Object.entries(candidatesByDiagnosis)) {
          console.log(`\n  🔬 Verifying ${candidates.length} candidates for "${diagnosisTerm}":`)
          
          const verifiedCandidates = []
          
          for (const candidate of candidates) {
            // Merge diagnosis context with patient context
            const fullContext = {
              ...patientContext,
              ...candidate.context
            }
            
            const verification = await icdVerifierAgent.verifyCode(candidate.code, fullContext)
            
            if (verification.valid) {
              // Calculate final confidence
              const finalConfidence = (candidate.confidence * 0.6) + (verification.confidence * 0.4)
              
              verifiedCandidates.push({
                ...candidate,
                confidence: finalConfidence,
                verified: true,
                needs_specifiers: verification.data.has_specifiers,
                warnings: verification.data.warnings || [],
                verification_data: verification.data
              })
              
              console.log(`     ${candidate.code}: ${(finalConfidence * 100).toFixed(1)}% confidence`)
              if (verification.data.warnings?.length > 0) {
                verification.data.warnings.forEach(w => console.log(`       ${w}`))
              }
            } else {
              console.log(`     ${candidate.code}: REJECTED - ${verification.reason}`)
            }
          }
          
          // Pick the HIGHEST confidence code for this diagnosis
          if (verifiedCandidates.length > 0) {
            const bestCandidate = verifiedCandidates.sort((a, b) => b.confidence - a.confidence)[0]
            foundCodes.push(bestCandidate)
            console.log(`  ✅ SELECTED: ${bestCandidate.code} (${(bestCandidate.confidence * 100).toFixed(1)}% confidence)`)
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

