// ICD Suggest & Specifier Tray - Diagnosis Details Route
// Provides comprehensive diagnosis information for confirmed ICD codes

import { getDiagnosisDetails } from '../database.js'

// =============================================================================
// DIAGNOSIS DETAILS ROUTE
// =============================================================================

/**
 * GET /api/details/:code
 * Get detailed diagnosis information for a specific ICD code
 */
export default async function detailsRoute(fastify, options) {
  fastify.get('/api/details/:code', async (request, reply) => {
    const startTime = Date.now()
    
    try {
      const { code } = request.params
      
      if (!code) {
        return reply.status(400).send({
          error: 'ICD code is required',
          code: null,
          details: null,
          latency_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        })
      }
      
      // Get detailed diagnosis information
      const details = await getDiagnosisDetails(code)
      
      if (!details) {
        return reply.status(404).send({
          error: 'Diagnosis details not found',
          code,
          details: null,
          latency_ms: Date.now() - startTime,
          timestamp: new Date().toISOString()
        })
      }
      
      // Return comprehensive diagnosis information
      return reply.send({
        code: details.code,
        details: {
          description: details.description,
          clinical_notes: details.clinical_notes,
          symptoms: details.symptoms || [],
          risk_factors: details.risk_factors || [],
          complications: details.complications || [],
          treatment_notes: details.treatment_notes,
          classification: {
            chapter: details.icd_chapter,
            block: details.icd_block,
            category: details.icd_category,
            body_system: details.body_system
          },
          demographics: {
            severity_levels: details.severity_levels || [],
            age_groups: details.age_groups || [],
            gender_preference: details.gender_preference
          },
          metadata: {
            created_at: details.created_at,
            updated_at: details.updated_at
          }
        },
        latency_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      console.error('❌ Error in details route:', error)
      
      return reply.status(500).send({
        error: 'Internal server error',
        message: error.message,
        code: request.params?.code || null,
        details: null,
        latency_ms: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }
  })
}
