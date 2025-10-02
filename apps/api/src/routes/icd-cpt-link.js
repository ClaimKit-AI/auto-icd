// ICD-CPT Medical Linking API Route
// AI-powered medical linking between diagnoses and procedures

import { getCPTForICD } from '../database.js';

/**
 * Register ICD-CPT linking routes
 */
export async function icdCptLinkRoutes(fastify, options) {
  /**
   * GET /api/icd/:code/cpt
   * Get medically appropriate CPT procedures for an ICD diagnosis
   */
  fastify.get('/:code/cpt', async (req, reply) => {
  try {
    const icdCode = req.params.code;
    const limit = parseInt(req.query.limit) || 5;
    
    const startTime = Date.now();
    
    // Get CPT suggestions for this ICD code
    const cptSuggestions = await getCPTForICD(icdCode, limit);
    
    const latency = Date.now() - startTime;
    
    reply.send({
      icd_code: icdCode,
      suggested_cpt: cptSuggestions,
      count: cptSuggestions.length,
      latency_ms: latency
    });
    
  } catch (error) {
    console.error('Error in ICD-CPT linking:', error);
    reply.status(500).send({ 
      error: 'Failed to fetch CPT suggestions',
      suggested_cpt: []
    });
  }
  });
}

