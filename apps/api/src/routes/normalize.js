// ICD Suggest & Specifier Tray - Normalize Route
// This handles text normalization: POST /api/normalize
// Converts medical text to ICD codes (e.g., "dm type 2 w/o comp" → E11.9)

import { getICDSuggestions } from '../database.js';

// =============================================================================
// NORMALIZE ROUTE HANDLER
// =============================================================================

/**
 * Normalize endpoint - converts medical text to ICD codes
 * This is useful for processing free-text medical descriptions
 */
export async function normalizeRoutes(fastify, options) {
  
  // POST /api/normalize
  fastify.post('/normalize', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Get text from request body
      const { text } = request.body;
      
      // Validate input
      if (!text || typeof text !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Text field is required in request body',
          example: { text: 'dm type 2 w/o comp' }
        });
      }
      
      // Clean and validate text
      const cleanText = text.trim();
      if (cleanText.length === 0) {
        return reply.send({
          candidates: [],
          original_text: cleanText,
          normalized_text: '',
          latency_ms: Date.now() - startTime
        });
      }
      
      // Normalize the text (expand abbreviations, handle common variations)
      const normalizedText = normalizeMedicalText(cleanText);
      
      // Get suggestions using the normalized text
      const maxCandidates = parseInt(process.env.MAX_SUGGESTIONS) || 5;
      const suggestions = await getICDSuggestions(normalizedText, maxCandidates);
      
      // Format response as candidates
      const candidates = suggestions.map(row => ({
        code: row.code,
        label: row.title,
        confidence: Math.min(row.score / 2.0, 1.0), // Convert score to 0-1 confidence
        match_type: getMatchType(row, normalizedText)
      }));
      
      // Calculate response time
      const latency = Date.now() - startTime;
      
      // Log performance for monitoring
      if (latency > 150) {
        fastify.log.warn(`🐌 Slow normalize query: ${latency}ms for "${cleanText}"`);
      }
      
      // Return successful response
      return reply.send({
        candidates: candidates,
        original_text: cleanText,
        normalized_text: normalizedText,
        count: candidates.length,
        latency_ms: latency,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      // Log error for debugging
      fastify.log.error('❌ Error in normalize endpoint:', error);
      
      // Return error response
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to normalize text. Please try again.',
        original_text: request.body?.text || '',
        latency_ms: Date.now() - startTime
      });
    }
  });
  
  // GET /api/normalize/health - Health check for this endpoint
  fastify.get('/normalize/health', async (request, reply) => {
    try {
      // Test with a simple medical abbreviation
      const testCandidates = await getICDSuggestions('dm', 1);
      
      return reply.send({
        status: 'healthy',
        endpoint: '/api/normalize',
        database_connected: true,
        test_query_works: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'unhealthy',
        endpoint: '/api/normalize',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalize medical text by expanding common abbreviations
 * @param {string} text - Original medical text
 * @returns {string} - Normalized text
 */
function normalizeMedicalText(text) {
  const lowerText = text.toLowerCase();
  
  // Common medical abbreviations and their expansions
  const abbreviations = {
    'dm': 'diabetes mellitus',
    'dm type 2': 'type 2 diabetes mellitus',
    'dm type 1': 'type 1 diabetes mellitus',
    'htn': 'hypertension',
    'mi': 'myocardial infarction',
    'copd': 'chronic obstructive pulmonary disease',
    'chf': 'congestive heart failure',
    'w/o': 'without',
    'w/': 'with',
    'comp': 'complications',
    'frac': 'fracture',
    'fx': 'fracture',
    'r/o': 'rule out',
    's/p': 'status post',
    'hx': 'history',
    'pt': 'patient'
  };
  
  let normalized = lowerText;
  
  // Replace abbreviations with full terms
  Object.entries(abbreviations).forEach(([abbrev, full]) => {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
    normalized = normalized.replace(regex, full);
  });
  
  return normalized;
}

/**
 * Determine the type of match for a suggestion
 * @param {Object} row - Database row with suggestion
 * @param {string} query - Search query
 * @returns {string} - Match type description
 */
function getMatchType(row, query) {
  const lowerQuery = query.toLowerCase();
  const lowerTitle = row.title.toLowerCase();
  const lowerCode = row.code.toLowerCase();
  
  if (lowerCode.includes(lowerQuery)) {
    return 'code_match';
  } else if (lowerTitle.startsWith(lowerQuery)) {
    return 'exact_prefix';
  } else if (lowerTitle.includes(lowerQuery)) {
    return 'partial_match';
  } else {
    return 'fuzzy_match';
  }
}
