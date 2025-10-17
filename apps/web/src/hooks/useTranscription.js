// Custom React Hook for Real-Time Medical Transcription
// Uses Deepgram SDK directly in browser for simplicity
// No backend proxy needed - direct connection to Deepgram

import { useState, useEffect, useCallback } from 'react'
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk'

/**
 * Custom hook for managing real-time transcription with Deepgram
 * 
 * Uses Deepgram browser SDK directly - handles all audio encoding automatically!
 */
export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [detectedCodes, setDetectedCodes] = useState([])
  const [error, setError] = useState(null)
  
  const [deepgramConnection, setDeepgramConnection] = useState(null)
  const [microphone, setMicrophone] = useState(null)
  const [keepAliveInterval, setKeepAliveInterval] = useState(null)
  
  /**
   * Start recording and connect to Deepgram
   */
  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true)
      setError(null)
      
      console.log('🎤 Requesting microphone access...')
      
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      setMicrophone(stream)
      console.log('✅ Microphone access granted')
      
      // For browser, we need to get API key from backend
      console.log('🔑 Fetching Deepgram API key...')
      const keyResponse = await fetch('/api/transcribe/key')
      const { apiKey } = await keyResponse.json()
      
      if (!apiKey) {
        throw new Error('Deepgram API key not available')
      }
      
      console.log('✅ API key received')
      
      // Create Deepgram client in browser
      const deepgram = createClient(apiKey)
      
      // Create live connection
      const connection = deepgram.listen.live({
        model: 'nova-3',
        language: 'en-US',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        keywords: ['diabetes:3', 'hypertension:3', 'fracture:3']
      })
      
      setDeepgramConnection(connection)
      console.log('🔗 Connecting to Deepgram...')
      
      // Handle Open event
      connection.on(LiveTranscriptionEvents.Open, () => {
        console.log('✅ Deepgram connection OPEN!')
        setIsConnecting(false)
        setIsRecording(true)
        
        // Get microphone stream using MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm'
        })
        
        // Send audio chunks to Deepgram
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && connection.getReadyState() === 1) {
            console.log('📤 Sending audio to Deepgram:', event.data.size, 'bytes')
            connection.send(event.data)
          }
        }
        
        // Start recording
        mediaRecorder.start(250) // Send chunks every 250ms
        console.log('▶️  Recording started!')
        
        // KeepAlive
        const interval = setInterval(() => {
          if (connection.getReadyState() === 1) {
            connection.keepAlive()
          }
        }, 5000)
        
        setKeepAliveInterval(interval)
        
        // Store mediaRecorder for cleanup
        stream.mediaRecorder = mediaRecorder
      })
      
      // Handle transcripts
      connection.on(LiveTranscriptionEvents.Transcript, (data) => {
        const text = data.channel?.alternatives?.[0]?.transcript
        if (!text) return
        
        const isFinal = data.is_final
        
        console.log(`📝 ${isFinal ? 'FINAL' : 'partial'}:`, text)
        
        if (isFinal) {
          setTranscript(prev => prev + (prev ? ' ' : '') + text)
          setPartialTranscript('')
          detectCodesFromText(text)
        } else {
          setPartialTranscript(text)
        }
      })
      
      // Handle errors
      connection.on(LiveTranscriptionEvents.Error, (error) => {
        console.error('❌ Deepgram error:', error)
        setError('Transcription error: ' + (error.message || 'Unknown'))
      })
      
      // Handle close
      connection.on(LiveTranscriptionEvents.Close, () => {
        console.log('🔌 Deepgram closed')
        setIsRecording(false)
      })
      
    } catch (err) {
      console.error('❌ Error starting recording:', err)
      setIsConnecting(false)
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied')
      } else {
        setError(err.message || 'Failed to start recording')
      }
    }
  }, [])
  
  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping recording...')
    
    // Stop MediaRecorder
    if (microphone?.mediaRecorder && microphone.mediaRecorder.state !== 'inactive') {
      microphone.mediaRecorder.stop()
    }
    
    // Stop microphone tracks
    if (microphone) {
      microphone.getTracks().forEach(track => track.stop())
      setMicrophone(null)
    }
    
    // Clear keep-alive
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval)
      setKeepAliveInterval(null)
    }
    
    // Close Deepgram connection
    if (deepgramConnection) {
      deepgramConnection.finish()
      setDeepgramConnection(null)
    }
    
    setIsRecording(false)
    setPartialTranscript('')
    console.log('✅ Recording stopped')
  }, [microphone, deepgramConnection, keepAliveInterval])
  
  /**
   * Detect medical codes from text
   */
  const detectCodesFromText = useCallback(async (text) => {
    const lower = text.toLowerCase()
    
    const keywords = {
      'diabetes': 'diabetes',
      'hypertension': 'hypertension',
      'fracture': 'fracture'
    }
    
    for (const [keyword, search] of Object.entries(keywords)) {
      if (lower.includes(keyword)) {
        try {
          const response = await fetch(`/api/suggest?q=${search}`)
          const data = await response.json()
          
          if (data.items?.[0]) {
            addDetectedCode({
              code: data.items[0].code,
              type: 'ICD',
              description: data.items[0].label,
              confidence: 0.85,
              trigger: keyword
            })
          }
        } catch (err) {
          console.error('Error detecting code:', err)
        }
        break
      }
    }
  }, [])
  
  /**
   * Add detected code
   */
  const addDetectedCode = useCallback((code) => {
    setDetectedCodes(prev => {
      const exists = prev.some(c => c.code === code.code)
      if (exists) return prev
      
      return [...prev, {
        ...code,
        timestamp: new Date().toISOString(),
        confirmed: false
      }]
    })
  }, [])
  
  /**
   * Confirm a code
   */
  const confirmCode = useCallback((codeObj) => {
    setDetectedCodes(prev => 
      prev.map(c => c.code === codeObj.code ? { ...c, confirmed: true } : c)
    )
  }, [])
  
  /**
   * Remove a code
   */
  const removeCode = useCallback((codeObj) => {
    setDetectedCodes(prev => prev.filter(c => c.code !== codeObj.code))
  }, [])
  
  /**
   * Clear all
   */
  const clearAll = useCallback(() => {
    setTranscript('')
    setPartialTranscript('')
    setDetectedCodes([])
  }, [])
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording()
      }
    }
  }, [isRecording, stopRecording])
  
  return {
    isRecording,
    isConnecting,
    transcript,
    partialTranscript,
    detectedCodes,
    error,
    startRecording,
    stopRecording,
    confirmCode,
    removeCode,
    clearAll
  }
}
