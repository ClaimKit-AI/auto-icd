// Real-Time Medical Transcription WebSocket Route
// Uses Deepgram for TRUE real-time streaming (<300ms latency)
// Detects medical codes from speech instantly

import { createClient } from '@deepgram/sdk'
import { getICDSuggestions, getCPTSuggestions } from '../database.js'

// Initialize Deepgram client
let deepgram = null
if (process.env.DEEPGRAM_API_KEY) {
  deepgram = createClient(process.env.DEEPGRAM_API_KEY)
}

/**
 * Register transcription WebSocket route
 * 
 * TRUE real-time streaming transcription:
 * 1. Deepgram WebSocket for instant speech-to-text
 * 2. Receives audio from frontend in real-time
 * 3. Sends transcribed text instantly (< 300ms latency)
 * 4. Auto-detects medical codes as you speak
 */
export async function transcribeRoutes(fastify, options) {
  
  /**
   * WebSocket endpoint for real-time transcription
   * GET /api/transcribe/stream (upgraded to WebSocket)
   */
  fastify.get('/stream', { websocket: true }, async (connection, req) => {
    console.log('🎙️ New real-time transcription session started (Deepgram)')
    
    let deepgramLive = null
    
    try {
      // Check API key
      if (!process.env.DEEPGRAM_API_KEY || !deepgram) {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'Deepgram API key not configured. Get free key at: https://console.deepgram.com/signup'
        }))
        connection.socket.close()
        return
      }
      
      // Create Deepgram live transcription connection
      deepgramLive = deepgram.listen.live({
        model: 'nova-2-medical', // Best model for medical terminology
        language: 'en',
        smart_format: true, // Auto punctuation
        interim_results: true, // Real-time partial transcripts
        endpointing: 300, // Faster sentence detection (300ms)
        utterance_end_ms: 1000, // 1 second silence = end of utterance
        vad_events: true, // Voice activity detection
        punctuate: true,
        profanity_filter: false // Don't filter medical terms
      })
      
      // Handle Deepgram connection opened
      deepgramLive.on('open', () => {
        console.log('✅ Connected to Deepgram - Real-time streaming active')
        
        connection.socket.send(JSON.stringify({
          type: 'status',
          message: 'Connected - Real-time transcription active'
        }))
      })
      
      // Handle real-time transcription results
      deepgramLive.on('Results', async (data) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript
        
        if (!transcript || transcript.trim().length === 0) return
        
        const isFinal = data.is_final
        const confidence = data.channel?.alternatives?.[0]?.confidence || 0
        
        console.log(`📝 ${isFinal ? 'Final' : 'Partial'}:`, transcript, `(${(confidence * 100).toFixed(0)}%)`)
        
        if (isFinal) {
          // Final transcript - send to frontend
          connection.socket.send(JSON.stringify({
            type: 'final',
            text: transcript,
            confidence: confidence
          }))
          
          // Auto-detect medical codes from final transcript
          await detectMedicalCodes(transcript, connection.socket)
        } else {
          // Partial transcript - send for real-time display
          connection.socket.send(JSON.stringify({
            type: 'partial',
            text: transcript,
            confidence: confidence
          }))
        }
      })
      
      // Handle errors
      deepgramLive.on('error', (error) => {
        console.error('❌ Deepgram error:', error)
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'Transcription error occurred'
        }))
      })
      
      // Handle warnings
      deepgramLive.on('warning', (warning) => {
        console.warn('⚠️  Deepgram warning:', warning)
      })
      
      // Handle metadata
      deepgramLive.on('Metadata', (metadata) => {
        console.log('📊 Metadata:', metadata)
      })
      
      // Handle Deepgram close
      deepgramLive.on('close', () => {
        console.log('🔌 Deepgram connection closed')
      })
      
      // Handle incoming audio from frontend (raw audio stream)
      connection.socket.on('message', (audioData) => {
        try {
          // Check if it's a ping message (keep-alive)
          if (audioData.toString().includes('ping')) {
            console.log('💓 Received ping - connection alive')
            return
          }
          
          // Forward raw audio to Deepgram in real-time
          if (deepgramLive && audioData) {
            // console.log('📥 Received audio chunk from frontend:', audioData.length, 'bytes')
            deepgramLive.send(audioData)
          }
        } catch (err) {
          console.error('Error sending audio to Deepgram:', err)
        }
      })
      
      // Handle frontend disconnect
      connection.socket.on('close', () => {
        console.log('👋 Frontend disconnected')
        if (deepgramLive) {
          deepgramLive.finish()
        }
      })
      
    } catch (error) {
      console.error('❌ Error in transcription route:', error)
      
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: error.message || 'Failed to start transcription'
      }))
      
      if (deepgramLive) {
        deepgramLive.finish()
      }
      
      connection.socket.close()
    }
  })
}

/**
 * Detect medical codes from transcribed text
 * Uses our existing ICD/CPT suggestion APIs
 * 
 * @param {string} text - Transcribed text
 * @param {WebSocket} socket - WebSocket connection to send codes
 */
async function detectMedicalCodes(text, socket) {
  const lowerText = text.toLowerCase()
  
  // Medical keyword mapping for ICD codes
  const icdKeywords = {
    'diabetes': 'diabetes',
    'diabetic': 'diabetes', 
    'type 2 diabetes': 'type 2 diabetes',
    'type two diabetes': 'type 2 diabetes',
    'type 1 diabetes': 'type 1 diabetes',
    'type one diabetes': 'type 1 diabetes',
    'hypertension': 'hypertension',
    'high blood pressure': 'hypertension',
    'fracture': 'fracture',
    'broken': 'fracture',
    'asthma': 'asthma',
    'copd': 'copd',
    'pneumonia': 'pneumonia',
    'depression': 'depression',
    'anxiety': 'anxiety',
    'infection': 'infection'
  }
  
  // Medical keyword mapping for CPT codes  
  const cptKeywords = {
    'blood test': 'blood',
    'lab test': 'laboratory',
    'x-ray': 'xray',
    'xray': 'xray',
    'ct scan': 'ct',
    'mri': 'mri',
    'ultrasound': 'ultrasound',
    'surgery': 'surgical',
    'exam': 'examination',
    'examination': 'examination',
    'screening': 'screening',
    'metabolic panel': 'metabolic panel'
  }
  
  // Check for ICD keywords
  for (const [keyword, searchTerm] of Object.entries(icdKeywords)) {
    if (lowerText.includes(keyword)) {
      try {
        const icdResults = await getICDSuggestions(searchTerm, 1)
        
        if (icdResults && icdResults.length > 0) {
          const topResult = icdResults[0]
          
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: topResult.code,
              type: 'ICD',
              description: topResult.title,
              confidence: 0.85,
              trigger: keyword
            }
          }))
          
          console.log(`🏥 Detected ICD: ${topResult.code} (trigger: "${keyword}")`)
        }
      } catch (err) {
        console.error(`Error detecting ICD for "${keyword}":`, err)
      }
      break // Only detect once per utterance
    }
  }
  
  // Check for CPT keywords
  for (const [keyword, searchTerm] of Object.entries(cptKeywords)) {
    if (lowerText.includes(keyword)) {
      try {
        const cptResults = await getCPTSuggestions(searchTerm, 1)
        
        if (cptResults && cptResults.length > 0) {
          const topResult = cptResults[0]
          
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: topResult.code,
              type: 'CPT',
              description: topResult.display || topResult.short_description,
              confidence: 0.75,
              trigger: keyword
            }
          }))
          
          console.log(`🏥 Detected CPT: ${topResult.code} (trigger: "${keyword}")`)
        }
      } catch (err) {
        console.error(`Error detecting CPT for "${keyword}":`, err)
      }
      break // Only detect once per utterance
    }
  }
}

export default transcribeRoutes

