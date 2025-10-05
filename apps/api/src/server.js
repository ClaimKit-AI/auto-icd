// ICD Suggest & Specifier Tray - Main API Server
// This is the main entry point for our backend API
// It sets up Fastify server with all routes and middleware

import dotenv from 'dotenv';

// Load environment variables from .env file FIRST
dotenv.config();

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

// Import our custom route handlers
import { suggestRoutes } from './routes/suggest.js';
import { rangesRoutes } from './routes/ranges.js';
import { normalizeRoutes } from './routes/normalize.js';
import { healthRoutes } from './routes/health.js';
import detailsRoute from './routes/details.js';
import { cptSuggestRoutes } from './routes/cpt-suggest.js';
import { icdCptLinkRoutes } from './routes/icd-cpt-link.js';
import { embeddingStatsRoutes } from './routes/embedding-stats.js';

// =============================================================================
// SERVER CONFIGURATION
// =============================================================================

// Create Fastify server instance with simple logging
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

// =============================================================================
// MIDDLEWARE SETUP
// =============================================================================

// Register CORS (Cross-Origin Resource Sharing) for frontend access
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
});

// Register security headers
await fastify.register(helmet, {
  contentSecurityPolicy: false // Disable for development
});

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

// Register all our API routes
await fastify.register(suggestRoutes, { prefix: '/api' });
await fastify.register(rangesRoutes, { prefix: '/api' });
await fastify.register(normalizeRoutes, { prefix: '/api' });
await fastify.register(healthRoutes, { prefix: '/api' });
await fastify.register(detailsRoute);
await fastify.register(cptSuggestRoutes, { prefix: '/api/cpt' });
await fastify.register(icdCptLinkRoutes, { prefix: '/api/icd' });
await fastify.register(embeddingStatsRoutes, { prefix: '/api/stats' });

// =============================================================================
// ERROR HANDLING
// =============================================================================

// Global error handler - catches any unhandled errors
fastify.setErrorHandler((error, request, reply) => {
  // Log the error for debugging
  fastify.log.error(error);
  
  // Send a safe error response (no sensitive info)
  reply.status(500).send({
    error: 'Internal Server Error',
    message: 'Something went wrong. Please try again.',
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors (route not found)
fastify.setNotFoundHandler((request, reply) => {
  reply.status(404).send({
    error: 'Not Found',
    message: `Route ${request.method} ${request.url} not found`,
    timestamp: new Date().toISOString()
  });
});

// =============================================================================
// SERVER STARTUP
// =============================================================================

// Function to start the server
const start = async () => {
  try {
    // Get port from environment or use default
    const port = process.env.PORT || 3000;
    
    // Start listening on the specified port
    await fastify.listen({ 
      port: port,
      host: '0.0.0.0' // Listen on all interfaces for Docker
    });
    
    // Log successful startup
    fastify.log.info(`🚀 ICD API Server running on port ${port}`);
    fastify.log.info(`📊 Health check: http://localhost:${port}/api/health`);
    fastify.log.info(`🔍 Suggest endpoint: http://localhost:${port}/api/suggest?q=hyp`);
    
  } catch (err) {
    // Log startup errors and exit
    fastify.log.error(err);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('🛑 Shutting down server...');
  await fastify.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  fastify.log.info('🛑 Shutting down server...');
  await fastify.close();
  process.exit(0);
});

// Start the server
start();
