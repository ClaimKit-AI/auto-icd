// Real-Time Medical Transcription WebSocket Route
// Uses OpenAI Whisper for high-quality medical transcription
// Detects medical codes from speech in real-time

import OpenAI from 'openai'
import { getICDSuggestions, getCPTSuggestions } from '../database.js'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * Register transcription WebSocket route
 * 
 * This creates a WebSocket endpoint that:
 * 1. Uses OpenAI Whisper for transcription (chunk-based)
 * 2. Receives audio chunks from frontend
 * 3. Sends transcribed text back
 * 4. Auto-detects medical codes from speech
 */
export async function transcribeRoutes(fastify, options) {
  
  /**
   * WebSocket endpoint for transcription
   * GET /api/transcribe/stream (upgraded to WebSocket)
   */
  fastify.get('/stream', { websocket: true }, async (connection, req) => {
    console.log('🎙️ New transcription session started (OpenAI Whisper)')
    
    let audioChunks = []
    let processingInterval = null
    
    try {
      // Check API key
      if (!process.env.OPENAI_API_KEY) {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'OpenAI API key not configured'
        }))
        connection.socket.close()
        return
      }
      
      // Send connection confirmation
      connection.socket.send(JSON.stringify({
        type: 'status',
        message: 'Connected - OpenAI Whisper ready'
      }))
      
      console.log('✅ WebSocket connected, ready for audio chunks')
      
      // Process accumulated audio every 3 seconds
      processingInterval = setInterval(async () => {
        if (audioChunks.length > 0) {
          await processAudioChunks(audioChunks, connection.socket)
          audioChunks = [] // Clear processed chunks
        }
      }, 3000) // Process every 3 seconds for near-real-time
      
      // Handle incoming audio from frontend
      connection.socket.on('message', async (message) => {
        try {
          // Accumulate audio chunks
          if (message instanceof Buffer || message instanceof ArrayBuffer) {
            audioChunks.push(Buffer.from(message))
            // console.log('📥 Received audio chunk:', message.length || message.byteLength, 'bytes')
          }
        } catch (err) {
          console.error('Error receiving audio:', err)
        }
      })
      
      // Handle frontend disconnect
      connection.socket.on('close', async () => {
        console.log('👋 Frontend disconnected')
        
        // Clear interval
        if (processingInterval) {
          clearInterval(processingInterval)
        }
        
        // Process any remaining audio
        if (audioChunks.length > 0) {
          await processAudioChunks(audioChunks, connection.socket)
        }
      })
      
    } catch (error) {
      console.error('❌ Error in transcription route:', error)
      
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: error.message || 'Failed to start transcription'
      }))
      
      connection.socket.close()
    }
  })
}

/**
 * Process accumulated audio chunks with OpenAI Whisper
 */
async function processAudioChunks(chunks, socket) {
  try {
    if (chunks.length === 0) return
    
    // Combine all chunks into single buffer
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const combinedBuffer = Buffer.concat(chunks, totalLength)
    
    console.log(`🎧 Processing ${chunks.length} audio chunks (${totalLength} bytes) with Whisper...`)
    
    // Convert buffer to File object for Whisper API
    const audioFile = new File([combinedBuffer], 'audio.webm', { type: 'audio/webm' })
    
    // Call OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json',
      temperature: 0.0 // Most accurate for medical terms
    })
    
    if (transcription.text && transcription.text.trim()) {
      console.log('📝 Transcribed:', transcription.text)
      
      // Send transcription to frontend
      socket.send(JSON.stringify({
        type: 'final',
        text: transcription.text,
        confidence: 0.95 // Whisper is very accurate
      }))
      
      // Auto-detect medical codes
      await detectMedicalCodes(transcription.text, socket)
    }
    
  } catch (error) {
    console.error('❌ Error processing audio with Whisper:', error)
    socket.send(JSON.stringify({
      type: 'error',
      message: 'Transcription failed. Please try again.'
    }))
  }
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
  
  // Medical keyword mapping
  const medicalKeywords = {
    // Endocrine
    'diabetes': 'diabetes',
    'diabetic': 'diabetes',
    'type 2 diabetes': 'type 2 diabetes',
    'type 1 diabetes': 'type 1 diabetes',
    
    // Cardiovascular
    'hypertension': 'hypertension',
    'high blood pressure': 'hypertension',
    'heart disease': 'heart disease',
    
    // Injuries
    'fracture': 'fracture',
    'broken': 'fracture',
    'break': 'fracture',
    
    // Respiratory
    'asthma': 'asthma',
    'copd': 'copd',
    'pneumonia': 'pneumonia',
    
    // Mental health
    'depression': 'depression',
    'anxiety': 'anxiety',
    
    // General
    'infection': 'infection',
    'pain': 'pain'
  }
  
  // Check for medical keywords
  for (const [keyword, searchTerm] of Object.entries(medicalKeywords)) {
    if (lowerText.includes(keyword)) {
      try {
        // Search for ICD codes
        const icdResults = await getICDSuggestions(searchTerm, 1)
        
        if (icdResults && icdResults.length > 0) {
          const topResult = icdResults[0]
          
          // Send detected ICD code to frontend
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: topResult.code,
              type: 'ICD',
              description: topResult.title,
              confidence: Math.min((topResult.score || 0.8) / 2.5, 0.95),
              trigger: keyword
            }
          }))
        }
        
      } catch (err) {
        console.error(`Error detecting code for "${keyword}":`, err)
      }
    }
  }
  
  // Detect procedure keywords for CPT codes
  const procedureKeywords = {
    'blood test': 'blood',
    'lab test': 'laboratory',
    'x-ray': 'xray',
    'ct scan': 'ct',
    'mri': 'mri',
    'ultrasound': 'ultrasound',
    'surgery': 'surgical',
    'exam': 'examination',
    'screening': 'screening'
  }
  
  for (const [keyword, searchTerm] of Object.entries(procedureKeywords)) {
    if (lowerText.includes(keyword)) {
      try {
        // Search for CPT codes
        const cptResults = await getCPTSuggestions(searchTerm, 1)
        
        if (cptResults && cptResults.length > 0) {
          const topResult = cptResults[0]
          
          // Send detected CPT code to frontend
          socket.send(JSON.stringify({
            type: 'code_detected',
            code: {
              code: topResult.code,
              type: 'CPT',
              description: topResult.display || topResult.short_description,
              confidence: 0.7,
              trigger: keyword
            }
          }))
        }
        
      } catch (err) {
        console.error(`Error detecting CPT code for "${keyword}":`, err)
      }
    }
  }
}

export default transcribeRoutes

