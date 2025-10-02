// ICD Suggest & Specifier Tray - Ranges Route
// This handles the specifier endpoint: GET /api/ranges/:code
// Returns ICD code modifiers (laterality, encounter, severity) for the right tray

import { getICDSpecifiers } from '../database.js';

// =============================================================================
// RANGES ROUTE HANDLER
// =============================================================================

/**
 * Ranges endpoint - returns ICD specifiers for a given code
 * This powers the right-hand specifier tray in the frontend
 */
export async function rangesRoutes(fastify, options) {
  
  // GET /api/ranges/:code
  fastify.get('/ranges/:code', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Get ICD code from URL parameter
      const { code } = request.params;
      
      // Validate input
      if (!code || typeof code !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Code parameter is required',
          example: '/api/ranges/S52.5'
        });
      }
      
      // Clean the code (remove any extra characters)
      const cleanCode = code.trim().toUpperCase();
      
      // Get specifiers from database
      const specifiersData = await getICDSpecifiers(cleanCode);
      
      // Calculate response time
      const latency = Date.now() - startTime;
      
      // Log performance for monitoring
      if (latency > 50) {
        fastify.log.warn(`🐌 Slow ranges query: ${latency}ms for "${cleanCode}"`);
      }
      
      // Return successful response
      return reply.send({
        code: cleanCode,
        root: specifiersData.root,
        specifiers: specifiersData.specifiers,
        has_specifiers: Object.keys(specifiersData.specifiers).length > 0,
        latency_ms: latency,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Log error for debugging
      fastify.log.error('❌ Error in ranges endpoint:', error);
      
      // Return error response
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get specifiers. Please try again.',
        code: request.params.code || '',
        latency_ms: Date.now() - startTime
      });
    }
  });
  
  // GET /api/ranges - Get all available specifier dimensions
  fastify.get('/ranges', async (request, reply) => {
    try {
      // This endpoint could return all available specifier types
      // Useful for frontend to know what dimensions exist
      
      const dimensions = [
        {
          name: 'laterality',
          description: 'Left or right side of body',
          examples: ['1 (Right)', '2 (Left)']
        },
        {
          name: 'encounter',
          description: 'Type of medical encounter',
          examples: ['A (Initial)', 'D (Subsequent)', 'S (Sequela)']
        },
        {
          name: 'severity',
          description: 'Severity level of condition',
          examples: ['1 (Mild)', '2 (Moderate)', '3 (Severe)']
        }
      ];
      
      return reply.send({
        dimensions: dimensions,
        description: 'Available ICD specifier dimensions',
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      fastify.log.error('❌ Error in ranges list endpoint:', error);
      
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get specifier dimensions',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // GET /api/ranges/health - Health check for this endpoint
  fastify.get('/ranges/health', async (request, reply) => {
    try {
      // Test with a known code that has specifiers
      const testSpecifiers = await getICDSpecifiers('S52.5');
      
      return reply.send({
        status: 'healthy',
        endpoint: '/api/ranges',
        database_connected: true,
        test_query_works: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'unhealthy',
        endpoint: '/api/ranges',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}
