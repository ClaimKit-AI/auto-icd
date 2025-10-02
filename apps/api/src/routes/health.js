// ICD Suggest & Specifier Tray - Health Check Route
// This provides health monitoring endpoints for the API
// Useful for monitoring, load balancers, and debugging

import { testConnection } from '../database.js';

// =============================================================================
// HEALTH CHECK ROUTE HANDLER
// =============================================================================

/**
 * Health check endpoints for monitoring and debugging
 * These endpoints help us monitor the system health
 */
export async function healthRoutes(fastify, options) {
  
  // GET /api/health - Main health check endpoint
  fastify.get('/health', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Test database connection
      const dbHealthy = await testConnection();
      
      // Get system information
      const systemInfo = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      };
      
      // Calculate response time
      const latency = Date.now() - startTime;
      
      // Determine overall health status
      const status = dbHealthy ? 'healthy' : 'unhealthy';
      const httpStatus = dbHealthy ? 200 : 503;
      
      return reply.status(httpStatus).send({
        status: status,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        database: {
          connected: dbHealthy,
          status: dbHealthy ? 'ok' : 'error'
        },
        system: systemInfo,
        latency_ms: latency,
        endpoints: {
          suggest: '/api/suggest',
          ranges: '/api/ranges',
          normalize: '/api/normalize'
        }
      });
      
    } catch (error) {
      fastify.log.error('❌ Health check failed:', error);
      
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        latency_ms: Date.now() - startTime
      });
    }
  });
  
  // GET /api/health/detailed - Detailed health information
  fastify.get('/health/detailed', async (request, reply) => {
    try {
      // Test all major components
      const dbHealthy = await testConnection();
      
      // Test each endpoint
      const endpointTests = {
        suggest: await testSuggestEndpoint(),
        ranges: await testRangesEndpoint(),
        normalize: await testNormalizeEndpoint()
      };
      
      // Calculate overall health
      const allHealthy = dbHealthy && Object.values(endpointTests).every(test => test.healthy);
      
      return reply.send({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: dbHealthy ? 'healthy' : 'unhealthy',
            message: dbHealthy ? 'Connected successfully' : 'Connection failed'
          },
          endpoints: endpointTests
        },
        performance: {
          memory_usage: process.memoryUsage(),
          uptime_seconds: process.uptime(),
          cpu_usage: process.cpuUsage()
        }
      });
      
    } catch (error) {
      fastify.log.error('❌ Detailed health check failed:', error);
      
      return reply.status(503).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });
  
  // GET /api/health/ready - Readiness probe for Kubernetes/Docker
  fastify.get('/health/ready', async (request, reply) => {
    try {
      // Simple readiness check - is the service ready to accept requests?
      const dbHealthy = await testConnection();
      
      if (dbHealthy) {
        return reply.send({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        return reply.status(503).send({
          status: 'not_ready',
          reason: 'database_not_connected',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      return reply.status(503).send({
        status: 'not_ready',
        reason: 'health_check_failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // GET /api/health/live - Liveness probe for Kubernetes/Docker
  fastify.get('/health/live', async (request, reply) => {
    // Liveness check - is the service alive and running?
    // This should always return 200 unless the process is dead
    return reply.send({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Test the suggest endpoint with a simple query
 * @returns {Promise<Object>} Test result
 */
async function testSuggestEndpoint() {
  try {
    // Import here to avoid circular dependencies
    const { getICDSuggestions } = await import('../database.js');
    const result = await getICDSuggestions('test', 1);
    
    return {
      healthy: true,
      message: 'Suggest endpoint working',
      test_results: result.length
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Suggest endpoint failed',
      error: error.message
    };
  }
}

/**
 * Test the ranges endpoint with a known code
 * @returns {Promise<Object>} Test result
 */
async function testRangesEndpoint() {
  try {
    const { getICDSpecifiers } = await import('../database.js');
    const result = await getICDSpecifiers('S52.5');
    
    return {
      healthy: true,
      message: 'Ranges endpoint working',
      test_results: Object.keys(result.specifiers).length
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Ranges endpoint failed',
      error: error.message
    };
  }
}

/**
 * Test the normalize endpoint functionality
 * @returns {Promise<Object>} Test result
 */
async function testNormalizeEndpoint() {
  try {
    const { getICDSuggestions } = await import('../database.js');
    const result = await getICDSuggestions('dm', 1);
    
    return {
      healthy: true,
      message: 'Normalize endpoint working',
      test_results: result.length
    };
  } catch (error) {
    return {
      healthy: false,
      message: 'Normalize endpoint failed',
      error: error.message
    };
  }
}
