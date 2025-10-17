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
 * Register transcription WebSocket route
 * Uses official Deepgram SDK pattern
 */
export async function transcribeRoutes(fastify, options) {
  
  /**
   * WebSocket endpoint for real-time transcription
   * GET /api/transcribe/stream (upgraded to WebSocket)
   */
  fastify.get('/stream', { websocket: true }, async (connection, req) => {
    console.log('🎙️ New real-time transcription session started (Deepgram Nova-3)')
    
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
      
      // STEP 2: Create a live transcription connection (from Deepgram docs)
      const deepgramLive = deepgram.listen.live({
        model: 'nova-3', // Latest model per docs
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
        punctuate: true,
        // Audio format
        encoding: 'linear16',
        sample_rate: 16000,
        channels: 1,
        // Medical keywords
        keywords: ['diabetes:3', 'hypertension:3', 'fracture:3', 'asthma:3']
      })
      
      // STEP 3: Listen for events (INSIDE Open handler per Deepgram docs pattern)
      deepgramLive.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection OPEN - Ready for audio')
        
        // Send status to frontend
        connection.socket.send(JSON.stringify({
          type: 'status',
          message: 'Connected - Ready for speech'
        }))
        
        // Handle Close event
        deepgramLive.on(LiveTranscriptionEvents.Close, () => {
          console.log('🔌 Deepgram connection closed')
        })
        
        // Handle Transcript event - THIS IS WHERE TRANSCRIPTS COME
        deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data) => {
          const transcript = data.channel?.alternatives?.[0]?.transcript
          
          if (!transcript || transcript.trim().length === 0) return
          
          const isFinal = data.is_final
          const confidence = data.channel?.alternatives?.[0]?.confidence || 0
          
          console.log(`📝 ${isFinal ? 'FINAL' : 'PARTIAL'}:`, transcript, `(${(confidence * 100).toFixed(0)}%)`)
          
          if (isFinal) {
            // Final transcript
            connection.socket.send(JSON.stringify({
              type: 'final',
              text: transcript,
              confidence: confidence
            }))
            
            // Detect medical codes
            await detectMedicalCodes(transcript, connection.socket)
          } else {
            // Partial transcript (real-time as you speak)
            connection.socket.send(JSON.stringify({
              type: 'partial',
              text: transcript,
              confidence: confidence
            }))
          }
        })
        
        // Handle Metadata
        deepgramLive.on(LiveTranscriptionEvents.Metadata, (data) => {
          console.log('📊 Metadata:', data)
        })
        
        // Handle Errors
        deepgramLive.on(LiveTranscriptionEvents.Error, (error) => {
          console.error('❌ Deepgram error:', error)
          console.error('Error details:', JSON.stringify(error, null, 2))
          
          connection.socket.send(JSON.stringify({
            type: 'error',
            message: error.message || 'Transcription error'
          }))
        })
        
        // Handle Warning
        deepgramLive.on(LiveTranscriptionEvents.Warning, (warning) => {
          console.warn('⚠️  Deepgram warning:', warning)
        })
        
        // STEP 4: Send audio data from frontend to Deepgram
        connection.socket.on('message', (audioData) => {
          try {
            // Skip ping messages
            if (audioData.toString().includes('ping')) {
              return
            }
            
            // Send audio to Deepgram
            if (audioData && audioData.length > 0) {
              console.log('📥 Audio:', audioData.length, 'bytes → Deepgram')
              deepgramLive.send(audioData)
            }
          } catch (err) {
            console.error('❌ Error forwarding audio:', err)
          }
        })
        
        // Send KeepAlive every 5 seconds
        const keepAlive = setInterval(() => {
          console.log('💓 Sending KeepAlive to Deepgram')
          deepgramLive.keepAlive()
        }, 5000)
        
        // Cleanup on disconnect
        connection.socket.on('close', () => {
          console.log('👋 Frontend disconnected - Cleaning up')
          clearInterval(keepAlive)
          deepgramLive.finish()
        })
      })
      
    } catch (error) {
      console.error('❌ Fatal error in transcription route:', error)
      
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: error.message || 'Failed to start transcription'
      }))
      
      connection.socket.close()
    }
  })
}

/**
 * Detect medical codes from transcribed text
 */
async function detectMedicalCodes(text, socket) {
  const lowerText = text.toLowerCase()
  
  // ICD keyword triggers
  const icdKeywords = {
    'diabetes': 'diabetes',
    'diabetic': 'diabetes',
    'type 2 diabetes': 'type 2 diabetes',
    'type two diabetes': 'type 2 diabetes',
    'hypertension': 'hypertension',
    'high blood pressure': 'hypertension',
    'fracture': 'fracture',
    'broken': 'fracture',
    'asthma': 'asthma',
    'pneumonia': 'pneumonia',
    'depression': 'depression'
  }
  
  // CPT keyword triggers
  const cptKeywords = {
    'blood test': 'blood',
    'lab test': 'laboratory',
    'x-ray': 'xray',
    'xray': 'xray',
    'ct scan': 'ct',
    'mri': 'mri',
    'ultrasound': 'ultrasound'
  }
  
  // Detect ICD codes
  for (const [keyword, searchTerm] of Object.entries(icdKeywords)) {
    if (lowerText.includes(keyword)) {
      try {
        const results = await getICDSuggestions(searchTerm, 1)
        
        if (results && results.length > 0) {
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: results[0].code,
              type: 'ICD',
              description: results[0].title,
              confidence: 0.85,
              trigger: keyword
            }
          }))
          
          console.log(`🏥 Detected ICD: ${results[0].code} from "${keyword}"`)
        }
      } catch (err) {
        console.error(`Error detecting ICD for "${keyword}":`, err)
      }
      break
    }
  }
  
  // Detect CPT codes
  for (const [keyword, searchTerm] of Object.entries(cptKeywords)) {
    if (lowerText.includes(keyword)) {
      try {
        const results = await getCPTSuggestions(searchTerm, 1)
        
        if (results && results.length > 0) {
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: results[0].code,
              type: 'CPT',
              description: results[0].display || results[0].short_description,
              confidence: 0.75,
              trigger: keyword
            }
          }))
          
          console.log(`🏥 Detected CPT: ${results[0].code} from "${keyword}"`)
        }
      } catch (err) {
        console.error(`Error detecting CPT for "${keyword}":`, err)
      }
      break
    }
  }
}

export default transcribeRoutes
