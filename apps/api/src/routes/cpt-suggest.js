// CPT Suggestion API Route
// Provides AI-powered CPT code search

import { getCPTSuggestions } from '../database.js';

/**
 * Register CPT suggestion routes
 */
export async function cptSuggestRoutes(fastify, options) {
  /**
   * GET /api/cpt/suggest?q=<query>
   * Search for CPT codes using AI-powered hybrid search
   */
  fastify.get('/suggest', async (req, reply) => {
    try {
      const query = req.query.q || '';
      
      if (!query || query.trim().length === 0) {
        return reply.send({ items: [], latency_ms: 0 });
      }
      
      const startTime = Date.now();
      
      // Get CPT suggestions
      const suggestions = await getCPTSuggestions(query);
      
      const latency = Date.now() - startTime;
      
      // Format response
      const formattedSuggestions = suggestions.map(cpt => ({
        code: cpt.code,
        label: cpt.short_description || cpt.display,
        fullDisplay: cpt.display,
        chapter: cpt.chapter,
        subchapter: cpt.subchapter,
        similarity: cpt.similarity
      }));
      
      reply.send({
        items: formattedSuggestions,
        latency_ms: latency,
        query: query
      });
      
    } catch (error) {
      console.error('Error in CPT suggest:', error);
      reply.status(500).send({ 
        error: 'Failed to fetch CPT suggestions',
        items: []
      });
    }
  });
}

