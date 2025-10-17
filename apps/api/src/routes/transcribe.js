// Real-Time Medical Transcription WebSocket Route  
// Uses Deepgram Nova-3 for TRUE real-time streaming
// Follows official Deepgram SDK pattern from docs

import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'
import { getICDSuggestions, getCPTSuggestions } from '../database.js'

// Initialize Deepgram client
let deepgram = null
if (process.env.DEEPGRAM_API_KEY) {
  deepgram = createClient(process.env.DEEPGRAM_API_KEY)
}

/**
 * Register transcription routes
 */
export async function transcribeRoutes(fastify, options) {
  
  /**
   * GET /api/transcribe/key
   * Provides Deepgram API key to frontend
   * (In production, you'd want authentication here)
   */
  fastify.get('/key', async (request, reply) => {
    if (!process.env.DEEPGRAM_API_KEY) {
      return reply.status(500).send({ error: 'Deepgram API key not configured' })
    }
    
    return reply.send({ apiKey: process.env.DEEPGRAM_API_KEY })
  })
  
  fastify.get('/stream', { websocket: true }, async (connection, req) => {
    console.log('🎙️ New transcription session started')
    
    try {
      // Check API key
      if (!process.env.DEEPGRAM_API_KEY || !deepgram) {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'Deepgram API key not configured'
        }))
        connection.socket.close()
        return
      }
      
      // Create Deepgram live connection
      const deepgramLive = deepgram.listen.live({
        model: 'nova-3',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        keywords: ['diabetes:3', 'hypertension:3', 'fracture:3', 'asthma:3']
      })
      
      let keepAliveInterval = null
      
      // Setup event handlers (per Deepgram docs pattern)
      deepgramLive.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram OPEN - Ready for audio')
        
        connection.socket.send(JSON.stringify({
          type: 'status',
          message: 'Connected - Ready for speech'
        }))
        
        // Start KeepAlive
        keepAliveInterval = setInterval(() => {
          if (deepgramLive) {
            deepgramLive.keepAlive()
          }
        }, 5000)
      })
      
      // Handle transcripts
      deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript
        if (!transcript) return
        
        const isFinal = data.is_final
        const confidence = data.channel?.alternatives?.[0]?.confidence || 0
        
        console.log(`📝 ${isFinal ? 'FINAL' : 'partial'}:`, transcript)
        
        connection.socket.send(JSON.stringify({
          type: isFinal ? 'final' : 'partial',
          text: transcript,
          confidence: confidence
        }))
        
        if (isFinal) {
          await detectMedicalCodes(transcript, connection.socket)
        }
      })
      
      // Handle errors
      deepgramLive.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Deepgram error:', error)
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: error.message || 'Transcription error'
        }))
      })
      
      // Handle close
      deepgramLive.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔌 Deepgram closed')
        if (keepAliveInterval) clearInterval(keepAliveInterval)
      })
      
      // Handle metadata
      deepgramLive.on(LiveTranscriptionEvents.Metadata, (data) => {
        console.log('📊 Metadata - channels:', data.channels, 'duration:', data.duration)
      })
      
      // Handle audio from frontend
      connection.socket.on('message', (audioData) => {
        try {
          if (audioData.toString().includes('ping')) return
          
          if (audioData && audioData.length > 0) {
            deepgramLive.send(audioData)
          }
        } catch (err) {
          console.error('Error forwarding audio:', err)
        }
      })
      
      // Handle disconnect
      connection.socket.on('close', () => {
        console.log('👋 Frontend disconnected')
        if (keepAliveInterval) clearInterval(keepAliveInterval)
        if (deepgramLive) deepgramLive.finish()
      })
      
    } catch (error) {
      console.error('❌ Fatal error:', error)
      connection.socket.close()
    }
  })
}

/**
 * Detect medical codes from transcribed text
 */
async function detectMedicalCodes(text, socket) {
  const lower = text.toLowerCase()
  
  const icdMap = {
    'diabetes': 'diabetes',
    'hypertension': 'hypertension',
    'fracture': 'fracture',
    'asthma': 'asthma'
  }
  
  for (const [keyword, search] of Object.entries(icdMap)) {
    if (lower.includes(keyword)) {
      try {
        const results = await getICDSuggestions(search, 1)
        if (results?.[0]) {
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: results[0].code,
              type: 'ICD',
              description: results[0].title,
              confidence: 0.85
            }
          }))
          console.log(`🏥 ICD detected: ${results[0].code}`)
        }
      } catch (err) {
        console.error('Error detecting ICD:', err)
      }
      break
    }
  }
}

export default transcribeRoutes
