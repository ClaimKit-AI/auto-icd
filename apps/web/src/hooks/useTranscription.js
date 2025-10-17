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
      
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000 // AssemblyAI recommended
        }
      })
      
      streamRef.current = stream
      
      // Create media recorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      })
      
      mediaRecorderRef.current = mediaRecorder
      
      // Connect to backend WebSocket (uses relative URL for production)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.hostname}:3000/api/transcribe/stream`
      
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      
      ws.onopen = () => {
        console.log('✅ Connected to transcription service')
        setIsConnecting(false)
        setIsRecording(true)
        
        // Send audio data
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data)
          }
        }
        
        // Start recording (send chunks every 100ms for real-time)
        mediaRecorder.start(100)
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
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
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
  }, [])
  
  /**
   * Handle incoming transcript messages from backend
   */
  const handleTranscriptMessage = useCallback((data) => {
    try {
      const message = JSON.parse(data)
      
      if (message.type === 'partial') {
        // Real-time partial transcript (not final)
        setPartialTranscript(message.text)
      } else if (message.type === 'final') {
        // Final transcript - append to full transcript
        setTranscript(prev => {
          const newText = prev + (prev ? ' ' : '') + message.text
          
          // Trigger code detection for the new text
          detectCodesFromText(message.text)
          
          return newText
        })
        setPartialTranscript('')
      } else if (message.type === 'code_detected') {
        // Backend detected a code
        addDetectedCode(message.code)
      } else if (message.type === 'error') {
        setError(message.message)
      }
    } catch (err) {
      console.error('Error parsing message:', err)
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

