// Custom React Hook for Real-Time Medical Transcription
// SIMPLE DIRECT APPROACH: Browser → Deepgram WebSocket (no backend proxy!)
// Based on: https://developers.deepgram.com/docs/live-streaming-audio

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook for managing transcription
 * 
 * Ultra-simple approach from YouTube tutorial:
 * - MediaRecorder (WebM) → Direct WebSocket to Deepgram
 * - No backend proxy needed!
 * - TRUE real-time streaming
 */
export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('') // Final confirmed transcripts
  const [partialTranscript, setPartialTranscript] = useState('') // Real-time preview
  const [currentInput, setCurrentInput] = useState('') // What's being built up
  const [detectedCodes, setDetectedCodes] = useState([])
  const [error, setError] = useState(null)
  
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const socketRef = useRef(null)
  
  /**
   * Start recording with direct Deepgram connection
   */
  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true)
      setError(null)
      
      console.log('🎤 Requesting microphone...')
      
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      console.log('✅ Microphone granted')
      
      // Get Deepgram API key from backend
      const keyResponse = await fetch('/api/transcribe/key')
      const { apiKey } = await keyResponse.json()
      
      if (!apiKey) {
        throw new Error('Deepgram API key not available')
      }
      
      console.log('🔑 API key received')
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      
      // Connect DIRECTLY to Deepgram (exact YouTube tutorial pattern)
      // API key goes in subprotocol, parameters in URL
      const socket = new WebSocket(
        'wss://api.deepgram.com/v1/listen?model=nova-3&language=en-US&smart_format=true&interim_results=true&punctuate=true',
        ['token', apiKey]
      )
      socketRef.current = socket
      
      console.log('🔗 Connecting to Deepgram with model nova-3...')
      
      // When WebSocket opens, start sending audio
      socket.onopen = () => {
        console.log('✅ Connected to Deepgram!')
        setIsConnecting(false)
        setIsRecording(true)
        
        // Send audio chunks to Deepgram
        mediaRecorder.addEventListener('dataavailable', event => {
          if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
            console.log('📤 Sending audio:', event.data.size, 'bytes')
            socket.send(event.data)
          }
        })
        
        // Start recording (send chunks every 250ms)
        mediaRecorder.start(250)
        console.log('▶️  Recording started - Streaming to Deepgram!')
      }
      
      // Receive transcripts from Deepgram
      socket.onmessage = (message) => {
        try {
          const received = JSON.parse(message.data)
          const text = received.channel?.alternatives?.[0]?.transcript
          
          if (!text || text.trim().length === 0) return
          
          const isFinal = received.is_final
          const confidence = received.channel?.alternatives?.[0]?.confidence || 0
          
          console.log(`📝 ${isFinal ? 'FINAL' : 'partial'}:`, text, `(${(confidence*100).toFixed(0)}%)`)
          
          if (isFinal) {
            // Final transcript - add to current input (not chat yet)
            setCurrentInput(prev => prev + (prev ? ' ' : '') + text)
            setPartialTranscript('')
            
            // Detect medical codes from the final text
            detectCodesFromText(text)
          } else {
            // Partial transcript - show in real-time preview only
            setPartialTranscript(text)
          }
          
        } catch (err) {
          console.error('Error parsing transcript:', err)
        }
      }
      
      // Handle errors
      socket.onerror = (err) => {
        console.error('❌ WebSocket error:', err)
        setError('Connection error')
      }
      
      // Handle close
      socket.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code)
        setIsRecording(false)
      }
      
    } catch (err) {
      console.error('❌ Error:', err)
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
    console.log('🛑 Stopping...')
    
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.close()
    }
    
    setIsRecording(false)
    setPartialTranscript('')
    console.log('✅ Stopped')
  }, [])
  
  /**
   * Detect codes from text using AI vector embeddings database
   * Works for ANY medical term - no hardcoded keywords!
   */
  const detectCodesFromText = async (text) => {
    const lower = text.toLowerCase()
    
    console.log('🔍 AI-detecting codes in:', text)
    
    // USE AI VECTOR DATABASE - search with the full transcribed text!
    try {
      // Query the AI-powered ICD suggestion API (uses vector embeddings)
      const response = await fetch(`/api/suggest?q=${encodeURIComponent(text)}`)
      const data = await response.json()
      
      if (data.items && data.items.length > 0) {
        const topMatch = data.items[0]
        
        console.log('🤖 AI vector search found:', topMatch.code, '-', topMatch.label)
        
        // Find best trigger word from the label that appears in text
        const labelWords = topMatch.label.toLowerCase().split(/\s+/)
        const textWords = lower.split(/\s+/)
        
        let trigger = textWords[0] // Default to first word
        for (const word of labelWords) {
          if (word.length > 4 && textWords.includes(word)) {
            trigger = word
            break
          }
        }
        
        addDetectedCode({
          code: topMatch.code,
          type: 'ICD',
          description: topMatch.label,
          confidence: 0.85,
          trigger: trigger
        })
        
        console.log('✅ Auto-detected ICD:', topMatch.code)
      } else {
        console.log('ℹ️  No ICD codes found for:', text)
      }
      
    } catch (err) {
      console.error('❌ Error in AI code detection:', err)
    }
  }
  
  const addDetectedCode = (code) => {
    setDetectedCodes(prev => {
      const exists = prev.some(c => c.code === code.code)
      if (exists) return prev
      return [...prev, { ...code, confirmed: false, timestamp: new Date().toISOString() }]
    })
  }
  
  const confirmCode = useCallback((code) => {
    setDetectedCodes(prev => 
      prev.map(c => c.code === code.code ? { ...c, confirmed: true } : c)
    )
  }, [])
  
  const removeCode = useCallback((code) => {
    setDetectedCodes(prev => prev.filter(c => c.code !== code.code))
  }, [])
  
  const clearAll = useCallback(() => {
    setTranscript('')
    setPartialTranscript('')
    setCurrentInput('')
    setDetectedCodes([])
  }, [])
  
  useEffect(() => {
    return () => {
      if (isRecording) stopRecording()
    }
  }, [isRecording, stopRecording])
  
  return {
    isRecording,
    isConnecting,
    transcript,
    partialTranscript,
    currentInput, // The text being built up (editable)
    detectedCodes,
    error,
    startRecording,
    stopRecording,
    confirmCode,
    removeCode,
    clearAll
  }
}
