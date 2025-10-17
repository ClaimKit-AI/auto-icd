// Real-Time Medical Transcription WebSocket Route
// Uses AssemblyAI SDK for real-time streaming
// Detects medical codes from speech in real-time

import { AssemblyAI } from 'assemblyai'
import { Readable, PassThrough } from 'stream'
import { getICDSuggestions, getCPTSuggestions } from '../database.js'

// Initialize AssemblyAI client
const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || ''
})

/**
 * Register transcription WebSocket route
 * 
 * This creates a WebSocket endpoint that:
 * 1. Connects to AssemblyAI real-time transcription using official SDK
 * 2. Receives audio from frontend
 * 3. Sends transcribed text back
 * 4. Auto-detects medical codes from speech
 */
export async function transcribeRoutes(fastify, options) {
  
  /**
   * WebSocket endpoint for real-time transcription
   * GET /api/transcribe/stream (upgraded to WebSocket)
   */
  fastify.get('/stream', { websocket: true }, async (connection, req) => {
    console.log('🎙️ New transcription session started')
    
    let transcriber = null
    let audioStream = null
    
    try {
      // Check API key
      if (!process.env.ASSEMBLYAI_API_KEY) {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'AssemblyAI API key not configured'
        }))
        connection.socket.close()
        return
      }
      
      // Create a PassThrough stream to pipe audio data
      audioStream = new PassThrough()
      
      // Create AssemblyAI transcriber with medical vocabulary
      transcriber = assemblyClient.realtime.transcriber({
        sampleRate: 16_000,
        encoding: 'pcm_s16le',
        formatTurns: true,
        disablePartialTranscripts: false // Enable real-time partials
      })
      
      // Handle session opened
      transcriber.on('open', ({ sessionId }) => {
        console.log('✅ Connected to AssemblyAI - Session:', sessionId)
        connection.socket.send(JSON.stringify({
          type: 'status',
          message: 'Connected to transcription service'
        }))
      })
      
      // Handle partial transcripts (real-time as you speak)
      transcriber.on('transcript', (transcript) => {
        if (!transcript.text) return
        
        console.log('📝 Transcript:', transcript.message_type, transcript.text)
        
        if (transcript.message_type === 'PartialTranscript') {
          // Send partial transcript to frontend
          connection.socket.send(JSON.stringify({
            type: 'partial',
            text: transcript.text,
            confidence: transcript.confidence
          }))
        } else if (transcript.message_type === 'FinalTranscript') {
          // Send final transcript to frontend
          connection.socket.send(JSON.stringify({
            type: 'final',
            text: transcript.text,
            confidence: transcript.confidence
          }))
          
          // Auto-detect medical codes from the final text
          detectMedicalCodes(transcript.text, connection.socket)
        }
      })
      
      // Handle errors
      transcriber.on('error', (error) => {
        console.error('❌ AssemblyAI error:', error)
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: error.message || 'Transcription error'
        }))
      })
      
      // Handle session closed
      transcriber.on('close', () => {
        console.log('🔌 AssemblyAI session closed')
      })
      
      // Connect to AssemblyAI
      await transcriber.connect()
      console.log('🎧 Transcriber connected, ready for audio')
      
      // Handle incoming audio from frontend
      connection.socket.on('message', async (message) => {
        try {
          // Audio data comes as Buffer
          if (message instanceof Buffer || message instanceof ArrayBuffer) {
            console.log('📤 Received audio chunk:', message.length || message.byteLength, 'bytes')
            
            // Send audio to AssemblyAI
            transcriber.sendAudio(message)
          }
        } catch (err) {
          console.error('Error sending audio:', err)
        }
      })
      
      // Handle frontend disconnect
      connection.socket.on('close', async () => {
        console.log('👋 Frontend disconnected')
        if (transcriber) {
          await transcriber.close()
        }
      })
      
    } catch (error) {
      console.error('❌ Error in transcription route:', error)
      
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: error.message || 'Failed to start transcription'
      }))
      
      if (transcriber) {
        await transcriber.close()
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

