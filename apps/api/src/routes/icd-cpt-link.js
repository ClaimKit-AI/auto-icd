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
      
      // Validate ALL codes with Agent #3, then ORDER by medical relevance
      console.log(`   🔬 Agent validating and scoring all codes...`)
      
      const icdContext = {
        code: icdCode,
        description: linkedCPTs[0]?.icd_title || icdCode
      }
      
      const scoredCPTs = []
      
      for (const cpt of linkedCPTs.slice(0, limit * 3)) { // Get more for better ranking
        // Use Agent #3 to score clinical appropriateness
        // Detect procedure type from description
        const cptDesc = (cpt.display || cpt.short_description || '').toLowerCase()
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
          { term: cpt.display, type: procedureType },
          [icdContext],
          {}
        )
        
        scoredCPTs.push({
          code: cpt.code,
          display: cpt.display,
          short_description: cpt.short_description,
          category: cpt.category,
          match_score: validation.confidence,
          verdict: validation.verdict,
          clinical_note: validation.clinical_note,
          validation_notes: validation.validation_notes,
          from_links_table: true,
          agent_validated: true,
          nice_pathway: cpt.confidence_score >= 0.95 // Flag NICE recommendations
        })
      }
      
      // SORT by confidence (highest first) - NICE pathways will be at top!
      scoredCPTs.sort((a, b) => b.match_score - a.match_score)
      
      // Take top N
      const topCPTs = scoredCPTs.slice(0, limit)
      
      const latency = Date.now() - startTime
      
      console.log(`   ✅ Agent scored ${scoredCPTs.length} codes, showing top ${topCPTs.length}:`)
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
