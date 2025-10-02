// ICD Suggest & Specifier Tray - Suggest Route
// This handles the main search endpoint: GET /api/suggest?q=...
// Returns real-time ICD code suggestions as the user types

import { getICDSuggestions } from '../database.js';

// =============================================================================
// SUGGEST ROUTE HANDLER
// =============================================================================

/**
 * Main suggest endpoint - returns ICD code suggestions
 * This is the core functionality of our app
 */
export async function suggestRoutes(fastify, options) {
  
  // GET /api/suggest?q=search_term
  fastify.get('/suggest', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Get search query from URL parameters
      const { q: query } = request.query;
      
      // Validate input
      if (!query || typeof query !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Query parameter "q" is required',
          example: '/api/suggest?q=hyp'
        });
      }
      
      // Clean and validate query
      const cleanQuery = query.trim();
      if (cleanQuery.length === 0) {
        return reply.send({
          items: [],
          completion: '',
          query: cleanQuery,
          latency_ms: Date.now() - startTime
        });
      }
      
      // Get maximum suggestions from environment or use default
      const maxSuggestions = parseInt(process.env.MAX_SUGGESTIONS) || 8;
      
      // Query database for suggestions
      const suggestions = await getICDSuggestions(cleanQuery, maxSuggestions);
      
      // Format response data
      const items = suggestions.map(row => ({
        code: row.code,
        label: row.title,
        score: row.score
      }));
      
      // Get the best completion text (for ghost completion)
      const completion = items.length > 0 ? items[0].label : '';
      
      // Calculate response time
      const latency = Date.now() - startTime;
      
      // Log performance for monitoring
      if (latency > 100) {
        fastify.log.warn(`🐌 Slow suggest query: ${latency}ms for "${cleanQuery}"`);
      }
      
      // Return successful response
      return reply.send({
        items: items,
        completion: completion,
        query: cleanQuery,
        latency_ms: latency,
        count: items.length
      });
      
    } catch (error) {
      // Log error for debugging
      fastify.log.error('❌ Error in suggest endpoint:', error);
      
      // Return error response
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get suggestions. Please try again.',
        query: request.query.q || '',
        latency_ms: Date.now() - startTime
      });
    }
  });
  
  // GET /api/suggest/health - Health check for this endpoint
  fastify.get('/suggest/health', async (request, reply) => {
    try {
      // Test with a simple query
      const testSuggestions = await getICDSuggestions('test', 1);
      
      return reply.send({
        status: 'healthy',
        endpoint: '/api/suggest',
        database_connected: true,
        test_query_works: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'unhealthy',
        endpoint: '/api/suggest',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}
