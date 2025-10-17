// Real-Time Medical Transcription - API Key Provider
// Browser connects DIRECTLY to Deepgram (YouTube tutorial pattern)
// No backend proxy needed - ultra-simple!

/**
 * Register transcription routes
 * 
 * Simple approach:
 * - Browser gets API key from this endpoint
 * - Browser connects directly to wss://api.deepgram.com
 * - No backend audio processing needed!
 */
export async function transcribeRoutes(fastify, options) {
  
  /**
   * GET /api/transcribe/key
   * Provides Deepgram API key to browser for direct connection
   */
  fastify.get('/key', async (request, reply) => {
    if (!process.env.DEEPGRAM_API_KEY) {
      return reply.status(500).send({ 
        error: 'Deepgram API key not configured',
        apiKey: null
      })
    }
    
    console.log('🔑 Providing Deepgram API key to browser')
    
    return reply.send({ 
      apiKey: process.env.DEEPGRAM_API_KEY,
      success: true
    })
  })
}

export default transcribeRoutes
