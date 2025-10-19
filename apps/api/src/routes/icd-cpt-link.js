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
      const limit = parseInt(req.query.limit) || 5
      
      const startTime = Date.now()
      
      console.log(`🏥 Finding CPT codes for ICD: ${icdCode} (AGENT-POWERED)`)
      
      // Get linked CPT codes from our 556K links table
      const linkedCPTs = await getLinkedCPTCodes(icdCode, limit * 2) // Get more for filtering
      
      if (!linkedCPTs || linkedCPTs.length === 0) {
        console.log(`   ⚠️  No linked CPT codes found for ${icdCode}`)
        return reply.send({
          icd_code: icdCode,
          suggested_cpt: [],
          count: 0,
          latency_ms: Date.now() - startTime,
          note: 'No CPT codes found in links table'
        })
      }
      
      console.log(`   🔗 Found ${linkedCPTs.length} linked CPT codes from 556K table`)
      
      // Validate with Agent #3 (CPT Matcher)
      const validatedCPTs = []
      const icdContext = {
        code: icdCode,
        description: linkedCPTs[0]?.icd_title || icdCode
      }
      
      for (const cpt of linkedCPTs) {
        // Use Agent #3 to validate clinical appropriateness
        const validation = await cptMatcherAgent.validateCPT(
          cpt,
          { term: cpt.display, type: 'lab' }, // Infer from description
          [icdContext],
          {}
        )
        
        // Only accept if >70% confidence AND not obviously wrong
        const isInappropriateSurgery = cpt.category?.toLowerCase().includes('surgery') && 
                                       validation.confidence < 0.85
        
        if (validation.valid && validation.confidence > 0.70 && !isInappropriateSurgery) {
          validatedCPTs.push({
            code: cpt.code,
            display: cpt.display,
            short_description: cpt.short_description,
            category: cpt.category,
            match_score: validation.confidence,
            verdict: validation.verdict,
            clinical_note: validation.clinical_note,
            validation_notes: validation.validation_notes,
            from_links_table: true,
            agent_validated: true
          })
        }
        
        if (validatedCPTs.length >= limit) break
      }
      
      const latency = Date.now() - startTime
      
      console.log(`   ✅ Agent validated ${validatedCPTs.length} CPT codes`)
      validatedCPTs.forEach(cpt => {
        console.log(`      ${cpt.code}: ${(cpt.match_score * 100).toFixed(0)}% - ${cpt.verdict}`)
      })
      
      return reply.send({
        icd_code: icdCode,
        suggested_cpt: validatedCPTs,
        count: validatedCPTs.length,
        latency_ms: latency,
        agent_validated: true,
        note: 'Validated by CPT Matcher Agent using 556K link relationships'
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
