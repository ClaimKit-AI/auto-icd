// Code Refinement Route - Agent-Powered ICD-CPT Pair Validation
// When user clicks a CPT, re-evaluate and suggest ICD specifiers for precision

import { icdVerifierAgent } from '../agents/icd-verifier-agent.js'
import { cptMatcherAgent } from '../agents/cpt-matcher-agent.js'
import { query } from '../database.js'

/**
 * Helper: Get reason why specifier is relevant for this CPT
 */
function getSpecifierReason(dimension, cptCode, cptDisplay) {
  const reasons = {
    'laterality': `${cptDisplay} may be side-specific - clarify left/right`,
    'severity': `Severity affects treatment approach`,
    'encounter': `Initial vs subsequent encounter determines procedure coding`,
    'complication': `Complications may require additional procedures`,
    'trimester': `Pregnancy timing affects testing protocols`
  }
  
  return reasons[dimension] || `Specify ${dimension} for more accurate coding`
}

/**
 * Register code refinement routes
 */
export async function refineCodesRoutes(fastify, options) {
  
  /**
   * POST /api/refine/icd-cpt-pair
   * Re-evaluate ICD-CPT pair and suggest refinements
   * 
   * Body: { icd_code: 'E03.9', cpt_code: '84443' }
   * Returns: Validation + specifier suggestions
   */
  fastify.post('/icd-cpt-pair', async (request, reply) => {
    try {
      const { icd_code, cpt_code } = request.body
      
      if (!icd_code || !cpt_code) {
        return reply.status(400).send({
          error: 'Both icd_code and cpt_code required',
          example: { icd_code: 'E03.9', cpt_code: '84443' }
        })
      }
      
      console.log(`🔬 Refining pair: ${icd_code} + ${cpt_code}`)
      
      const startTime = Date.now()
      
      // Step 1: Get ICD details
      const icdResult = await query(`
        SELECT code, title, has_specifiers
        FROM icd_codes
        WHERE code = $1
      `, [icd_code])
      
      if (icdResult.rows.length === 0) {
        return reply.status(404).send({ error: 'ICD code not found' })
      }
      
      const icdData = icdResult.rows[0]
      
      // Step 2: Get CPT details
      const cptResult = await query(`
        SELECT code, display, short_description
        FROM cpt_codes
        WHERE code = $1
      `, [cpt_code])
      
      if (cptResult.rows.length === 0) {
        return reply.status(404).send({ error: 'CPT code not found' })
      }
      
      const cptData = cptResult.rows[0]
      
      console.log(`   ICD: ${icd_code} - ${icdData.title}`)
      console.log(`   CPT: ${cpt_code} - ${cptData.display}`)
      
      // Step 3: Validate pair with agents
      console.log(`\n   🤖 Validating pair with agents...`)
      
      // Agent #2: Verify ICD
      const icdVerification = await icdVerifierAgent.verifyCode(icd_code, {})
      
      // Agent #3: Validate CPT for this ICD
      const cptValidation = await cptMatcherAgent.validateCPT(
        cptData,
        { term: cptData.display, type: 'lab' },
        [{ code: icd_code, description: icdData.title }],
        {}
      )
      
      // Step 4: Calculate pair appropriateness
      const pairScore = (icdVerification.confidence * 0.40) + (cptValidation.confidence * 0.60)
      
      console.log(`   ✅ ICD verification: ${(icdVerification.confidence * 100).toFixed(0)}% - ${icdVerification.verdict}`)
      console.log(`   ✅ CPT validation: ${(cptValidation.confidence * 100).toFixed(0)}% - ${cptValidation.verdict}`)
      console.log(`   🎯 Pair appropriateness: ${(pairScore * 100).toFixed(0)}%`)
      
      // Step 5: Get specifier suggestions if available
      let specifierSuggestions = []
      
      if (icdData.has_specifiers) {
        console.log(`\n   🔧 ICD has specifiers available - fetching suggestions...`)
        
        const specResult = await query(`
          SELECT dimension, code_suffix, label
          FROM icd_specifiers
          WHERE root_code = $1
          ORDER BY dimension, code_suffix
        `, [icd_code])
        
        if (specResult.rows.length > 0) {
          // Group by dimension
          const grouped = {}
          specResult.rows.forEach(spec => {
            if (!grouped[spec.dimension]) {
              grouped[spec.dimension] = []
            }
            grouped[spec.dimension].push({
              suffix: spec.code_suffix,
              label: spec.label,
              full_code: icd_code + spec.code_suffix
            })
          })
          
          specifierSuggestions = Object.entries(grouped).map(([dimension, options]) => ({
            dimension,
            options,
            why: getSpecifierReason(dimension, cpt_code, cptData.display)
          }))
          
          console.log(`   💡 Found ${specResult.rows.length} specifiers in ${Object.keys(grouped).length} dimensions`)
        }
      }
      
      // Step 6: Generate refinement recommendations
      const recommendations = []
      
      if (specifierSuggestions.length > 0) {
        recommendations.push({
          type: 'add_specifiers',
          priority: 'high',
          message: `Add specificity to ${icd_code} for more accurate CPT matching`,
          action: `Select ${specifierSuggestions.map(s => s.dimension).join(', ')} specifiers`,
          benefit: `Could improve pair score from ${(pairScore * 100).toFixed(0)}% to 90%+`
        })
      }
      
      if (icdVerification.data?.more_specific_codes?.length > 0) {
        recommendations.push({
          type: 'consider_specific',
          priority: 'medium',
          message: 'More specific ICD codes available',
          alternatives: icdVerification.data.more_specific_codes.slice(0, 3),
          benefit: 'More precise diagnosis coding'
        })
      }
      
      if (pairScore < 0.75) {
        recommendations.push({
          type: 'low_appropriateness',
          priority: 'medium',
          message: `Pair appropriateness is ${(pairScore * 100).toFixed(0)}% - consider alternatives`,
          action: 'Review CPT selection or add ICD specifiers'
        })
      }
      
      const latency = Date.now() - startTime
      
      return reply.send({
        success: true,
        icd: {
          code: icd_code,
          title: icdData.title,
          has_specifiers: icdData.has_specifiers,
          verification: icdVerification
        },
        cpt: {
          code: cpt_code,
          display: cptData.display,
          short_description: cptData.short_description,
          validation: cptValidation
        },
        pair_score: pairScore,
        verdict: pairScore >= 0.90 ? 'EXCELLENT' : 
                pairScore >= 0.75 ? 'GOOD' : 
                pairScore >= 0.60 ? 'ACCEPTABLE' : 'REVIEW_NEEDED',
        specifier_suggestions: specifierSuggestions,
        recommendations: recommendations,
        latency_ms: latency
      })
      
    } catch (error) {
      console.error('❌ Refinement error:', error)
      return reply.status(500).send({
        error: 'Code refinement failed',
        message: error.message
      })
    }
  })
}

export default refineCodesRoutes

