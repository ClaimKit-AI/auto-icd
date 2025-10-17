// Real-Time Medical Transcription WebSocket Route
// Proxies AssemblyAI real-time streaming to frontend
// Detects medical codes from speech in real-time

import WebSocket from 'ws'
import { getICDSuggestions, getCPTSuggestions } from '../database.js'

/**
 * Register transcription WebSocket route
 * 
 * This creates a WebSocket endpoint that:
 * 1. Connects to AssemblyAI real-time transcription
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
    
    let assemblyWs = null
    
    try {
      // Get AssemblyAI API key from environment
      const assemblyApiKey = process.env.ASSEMBLYAI_API_KEY
      
      if (!assemblyApiKey) {
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'AssemblyAI API key not configured'
        }))
        connection.socket.close()
        return
      }
      
      // Connect to AssemblyAI Real-Time API
      assemblyWs = new WebSocket(
        'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000',
        {
          headers: {
            authorization: assemblyApiKey
          }
        }
      )
      
      // Handle AssemblyAI connection
      assemblyWs.on('open', () => {
        console.log('✅ Connected to AssemblyAI')
        
        connection.socket.send(JSON.stringify({
          type: 'status',
          message: 'Connected to transcription service'
        }))
      })
      
      // Handle incoming transcription from AssemblyAI
      assemblyWs.on('message', async (data) => {
        try {
          const message = JSON.parse(data)
          
          // Handle different AssemblyAI message types
          if (message.message_type === 'PartialTranscript') {
            // Send partial transcript to frontend
            connection.socket.send(JSON.stringify({
              type: 'partial',
              text: message.text,
              confidence: message.confidence
            }))
          } else if (message.message_type === 'FinalTranscript') {
            // Send final transcript to frontend
            connection.socket.send(JSON.stringify({
              type: 'final',
              text: message.text,
              confidence: message.confidence
            }))
            
            // Auto-detect medical codes from the final text
            await detectMedicalCodes(message.text, connection.socket)
          } else if (message.message_type === 'SessionBegins') {
            console.log('📝 Transcription session active')
          }
        } catch (err) {
          console.error('Error processing AssemblyAI message:', err)
        }
      })
      
      // Handle AssemblyAI errors
      assemblyWs.on('error', (err) => {
        console.error('❌ AssemblyAI error:', err)
        connection.socket.send(JSON.stringify({
          type: 'error',
          message: 'Transcription service error'
        }))
      })
      
      // Handle AssemblyAI close
      assemblyWs.on('close', () => {
        console.log('🔌 AssemblyAI connection closed')
      })
      
      // Handle incoming audio from frontend
      connection.socket.on('message', (audioData) => {
        // Forward audio to AssemblyAI
        if (assemblyWs && assemblyWs.readyState === WebSocket.OPEN) {
          // Convert audio data to base64 if needed
          const base64Audio = audioData.toString('base64')
          assemblyWs.send(JSON.stringify({ audio_data: base64Audio }))
        }
      })
      
      // Handle frontend disconnect
      connection.socket.on('close', () => {
        console.log('👋 Frontend disconnected')
        if (assemblyWs) {
          assemblyWs.close()
        }
      })
      
    } catch (error) {
      console.error('❌ Error in transcription route:', error)
      
      connection.socket.send(JSON.stringify({
        type: 'error',
        message: 'Failed to start transcription service'
      }))
      
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

