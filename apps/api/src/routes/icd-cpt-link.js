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
      
      // Get ICD details to determine specialty
      const { query } = await import('../database.js')
      const icdDetailsResult = await query(`
        SELECT code, title, chapter
        FROM icd_codes
        WHERE code = $1
      `, [icdCode])
      
      const icdDetails = icdDetailsResult.rows[0]
      const icdTitle = icdDetails?.title?.toLowerCase() || ''
      
      // Get linked CPT codes from our 556K links table
      let linkedCPTs = await getLinkedCPTCodes(icdCode, limit * 3) || []
      
      console.log(`   🔗 Found ${linkedCPTs.length} linked CPT codes from 556K table`)
      
      // SPECIAL CASE: For fractures, ACTIVELY SEARCH for imaging CPTs (they might not be in links)
      if ((icdCode.match(/^S[0-9]/) || icdCode.match(/^M96|^M97/)) && icdTitle.match(/fracture/)) {
        console.log(`   🩻 FRACTURE DETECTED - Searching for imaging CPTs...`)
        
        const { getCPTSuggestions } = await import('../database.js')
        
        // Search for imaging procedures based on anatomical region
        const anatomyMatch = icdTitle.match(/clavicle|radius|ulna|humerus|tibia|fibula|femur|skull|spine|vertebra|rib|pelvis|wrist|ankle|finger|hand|foot/)
        const anatomy = anatomyMatch ? anatomyMatch[0] : 'bone'
        
        const imagingSearches = [
          `x-ray ${anatomy}`,
          `xray ${anatomy}`,
          `ct ${anatomy}`,
          `mri ${anatomy}`,
          `radiograph ${anatomy}`
        ]
        
        for (const search of imagingSearches) {
          try {
            const imagingCPTs = await getCPTSuggestions(search, 5)
            if (imagingCPTs && imagingCPTs.length > 0) {
              console.log(`      🔍 Found ${imagingCPTs.length} imaging CPTs for "${search}"`)
              // Add them to the front of the list with special flag
              imagingCPTs.forEach(img => {
                if (!linkedCPTs.find(c => c.code === img.code)) {
                  linkedCPTs.unshift({
                    ...img,
                    from_imaging_search: true,
                    confidence_score: 0.99 // Mark as ESSENTIAL
                  })
                }
              })
            }
          } catch (err) {
            console.log(`      ⚠️  Imaging search failed for "${search}":`, err.message)
          }
        }
        
        console.log(`   ✅ Total CPT candidates (with imaging): ${linkedCPTs.length}`)
      }
      
      if (!linkedCPTs || linkedCPTs.length === 0) {
        console.log(`   ⚠️  No CPT codes found for ${icdCode}`)
        return reply.send({
          icd_code: icdCode,
          suggested_cpt: [],
          count: 0,
          latency_ms: Date.now() - startTime,
          note: 'No CPT codes found'
        })
      }
      
      // Validate ALL codes with Agent #3, then ORDER by medical relevance
      console.log(`   🔬 Agent validating and scoring all codes...`)
      
      const icdContext = {
        code: icdCode,
        description: linkedCPTs[0]?.icd_title || icdCode
      }
      
      const scoredCPTs = []
      
      for (const cpt of linkedCPTs.slice(0, limit * 5)) { // Get more for better ranking
        // Use Agent #3 to score clinical appropriateness
        // Detect procedure type from description
        const cptDesc = (cpt.display || cpt.short_description || cpt.label || '').toLowerCase()
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
          { term: cpt.display || cpt.label, type: procedureType },
          [icdContext],
          {}
        )
        
        // MEGA BOOST for imaging CPTs found via search (ESSENTIAL for fractures!)
        let finalScore = validation.confidence
        if (cpt.from_imaging_search) {
          finalScore = Math.min(0.98, validation.confidence + 0.30) // +30% boost!
          console.log(`      🩻 IMAGING BOOST: ${cpt.code} from ${(validation.confidence * 100).toFixed(0)}% → ${(finalScore * 100).toFixed(0)}%`)
        }
        
        scoredCPTs.push({
          code: cpt.code,
          display: cpt.display || cpt.label,
          short_description: cpt.short_description,
          category: cpt.category,
          match_score: finalScore,
          verdict: validation.verdict,
          clinical_note: validation.clinical_note,
          validation_notes: validation.validation_notes,
          from_links_table: !cpt.from_imaging_search,
          from_imaging_search: cpt.from_imaging_search || false,
          agent_validated: true,
          nice_pathway: cpt.confidence_score >= 0.95 || cpt.from_imaging_search // Imaging = NICE pathway!
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
