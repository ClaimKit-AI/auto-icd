// Custom React Hook for Real-Time Medical Transcription
// Manages WebSocket connection to AssemblyAI and code detection

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for managing real-time transcription
 * 
 * Features:
 * - Connects to AssemblyAI via backend WebSocket
 * - Manages recording state
 * - Handles real-time transcript updates
 * - Auto-detects medical codes from speech
 * 
 * @returns {Object} Transcription state and controls
 */
export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [detectedCodes, setDetectedCodes] = useState([])
  const [error, setError] = useState(null)
  
  const wsRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  
  /**
   * Start recording and connect to transcription service
   */
  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true)
      setError(null)
      
      // Get microphone access with specific settings for AssemblyAI
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1, // Mono audio
          sampleRate: 16000 // AssemblyAI requirement
        }
      })
      
      streamRef.current = stream
      
      // Use Web Audio API to get PCM data
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000
      })
      
      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      mediaRecorderRef.current = { audioContext, processor, source }
      
      // Connect to backend WebSocket (uses relative URL for production)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.hostname === 'localhost' ? 'localhost:3000' : window.location.host
      const wsUrl = `${protocol}//${host}/api/transcribe/stream`
      
      console.log('🔗 Connecting to:', wsUrl)
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('✅ Connected to transcription WebSocket')
        setIsConnecting(false)
        setIsRecording(true)
        
        // Process audio and send to backend
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            // Get PCM audio data
            const inputData = e.inputBuffer.getChannelData(0)
            
            // Convert Float32Array to Int16Array (PCM 16-bit)
            const pcmData = new Int16Array(inputData.length)
            for (let i = 0; i < inputData.length; i++) {
              // Convert -1.0 to 1.0 range to -32768 to 32767
              pcmData[i] = Math.max(-32768, Math.min(32767, Math.floor(inputData[i] * 32768)))
            }
            
            // Send PCM data to backend
            ws.send(pcmData.buffer)
          }
        }
        
        console.log('▶️  Recording started, processing audio in real-time')
      }
      
      ws.onmessage = (event) => {
        handleTranscriptMessage(event.data)
      }
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err)
        setError('Connection failed. Please check your internet connection.')
        stopRecording()
      }
      
      ws.onclose = () => {
        console.log('WebSocket closed')
        setIsRecording(false)
      }
      
    } catch (err) {
      console.error('Error starting recording:', err)
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow microphone access.')
      } else if (err.name === 'NotFoundError') {
        setError('No microphone found. Please connect a microphone.')
      } else {
        setError('Failed to start recording. Please try again.')
      }
      
      setIsConnecting(false)
    }
  }, [])
  
  /**
   * Stop recording and close all connections
   */
  const stopRecording = useCallback(() => {
    console.log('🛑 Stopping recording...')
    
    // Cleanup Web Audio API
    if (mediaRecorderRef.current) {
      const { audioContext, processor, source } = mediaRecorderRef.current
      
      if (processor) {
        processor.onaudioprocess = null
        processor.disconnect()
      }
      
      if (source) {
        source.disconnect()
      }
      
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close()
      }
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    
    // Close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close()
    }
    
    setIsRecording(false)
    setPartialTranscript('')
    console.log('✅ Recording stopped')
  }, [])
  
  /**
   * Handle incoming transcript messages from backend
   */
  const handleTranscriptMessage = useCallback((data) => {
    try {
      console.log('📥 Received message:', data)
      const message = JSON.parse(data)
      
      if (message.type === 'partial') {
        // Real-time partial transcript (not final)
        console.log('📝 Partial:', message.text)
        setPartialTranscript(message.text)
      } else if (message.type === 'final') {
        // Final transcript - append to full transcript
        console.log('✅ Final:', message.text)
        setTranscript(prev => {
          const newText = prev + (prev ? ' ' : '') + message.text
          
          // Trigger code detection for the new text
          detectCodesFromText(message.text)
          
          return newText
        })
        setPartialTranscript('')
      } else if (message.type === 'code_detected') {
        // Backend detected a code
        console.log('🏥 Code detected:', message.code)
        addDetectedCode(message.code)
      } else if (message.type === 'error') {
        console.error('❌ Error from backend:', message.message)
        setError(message.message)
      } else if (message.type === 'status') {
        console.log('ℹ️  Status:', message.message)
      }
    } catch (err) {
      console.error('Error parsing message:', err, 'Raw data:', data)
    }
  }, [])
  
  /**
   * Detect medical codes from transcribed text
   * Uses our existing ICD/CPT suggestion APIs
   */
  const detectCodesFromText = useCallback(async (text) => {
    const lowerText = text.toLowerCase()
    
    // Medical keywords that trigger ICD search
    const keywords = {
      diabetes: ['diabetes', 'diabetic', 'dm type'],
      hypertension: ['hypertension', 'high blood pressure', 'htn'],
      fracture: ['fracture', 'broken bone', 'break'],
      asthma: ['asthma', 'reactive airway'],
      depression: ['depression', 'depressed', 'major depressive'],
      infection: ['infection', 'infected'],
      pain: ['pain', 'painful']
    }
    
    // Check for keyword matches
    for (const [key, variations] of Object.entries(keywords)) {
      for (const variation of variations) {
        if (lowerText.includes(variation)) {
          // Query ICD codes
          try {
            const response = await fetch(`/api/suggest?q=${key}`)
            const data = await response.json()
            
            if (data.items && data.items.length > 0) {
              addDetectedCode({
                code: data.items[0].code,
                type: 'ICD',
                description: data.items[0].label,
                confidence: 0.75,
                trigger: variation
              })
            }
          } catch (err) {
            console.error('Error detecting code:', err)
          }
          break // Only detect once per keyword
        }
      }
    }
  }, [])
  
  /**
   * Add a detected code to the list
   */
  const addDetectedCode = useCallback((code) => {
    setDetectedCodes(prev => {
      // Check if code already exists
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
   * Confirm a detected code
   */
  const confirmCode = useCallback((codeObj) => {
    setDetectedCodes(prev => 
      prev.map(c => c.code === codeObj.code ? { ...c, confirmed: true } : c)
    )
  }, [])
  
  /**
   * Remove a detected code
   */
  const removeCode = useCallback((codeObj) => {
    setDetectedCodes(prev => prev.filter(c => c.code !== codeObj.code))
  }, [])
  
  /**
   * Clear all transcript and codes
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

