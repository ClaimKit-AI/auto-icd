// Custom React Hook for Real-Time Medical Transcription
// Simple approach: Record in browser, transcribe in chunks via backend
// Near-real-time with proven reliability

import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Custom hook for managing transcription
 * 
 * Simple, reliable approach:
 * - Record audio in browser with MediaRecorder
 * - Send chunks to backend every 2 seconds
 * - Backend uses Deepgram to transcribe
 * - Near-real-time results
 */
export function useTranscription() {
  const [isRecording, setIsRecording] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [partialTranscript, setPartialTranscript] = useState('')
  const [detectedCodes, setDetectedCodes] = useState([])
  const [error, setError] = useState(null)
  
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  
  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      setIsConnecting(true)
      setError(null)
      
      console.log('🎤 Requesting microphone...')
      
      // Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      
      streamRef.current = stream
      console.log('✅ Microphone granted')
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      })
      
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []
      
      // Collect audio chunks
      mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
          console.log('📥 Collected chunk:', event.data.size, 'bytes')
          
          // When we have chunks, send to backend for transcription
          if (chunksRef.current.length > 0) {
            await transcribeChunks()
          }
        }
      }
      
      mediaRecorder.onstart = () => {
        console.log('▶️  Recording started')
        setIsConnecting(false)
        setIsRecording(true)
      }
      
      mediaRecorder.onerror = (err) => {
        console.error('❌ MediaRecorder error:', err)
        setError('Recording failed')
      }
      
      // Start recording - collect chunks every 2 seconds
      mediaRecorder.start(2000)
      console.log('🎙️ Recording... will transcribe every 2 seconds')
      
    } catch (err) {
      console.error('❌ Error:', err)
      setIsConnecting(false)
      
      if (err.name === 'NotAllowedError') {
        setError('Microphone permission denied')
      } else {
        setError('Failed to start recording')
      }
    }
  }, [])
  
  /**
   * Transcribe collected chunks
   */
  const transcribeChunks = async () => {
    if (chunksRef.current.length === 0) return
    
    try {
      // Create audio blob from chunks
      const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
      chunksRef.current = [] // Clear chunks
      
      console.log('🎧 Transcribing audio blob:', audioBlob.size, 'bytes')
      
      // Send to backend for transcription
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      
      const response = await fetch('/api/transcribe/audio', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.text && data.text.trim()) {
        console.log('📝 Transcribed:', data.text)
        
        // Append to transcript
        setTranscript(prev => prev + (prev ? ' ' : '') + data.text)
        
        // Detect codes
        await detectCodesFromText(data.text)
      }
      
    } catch (err) {
      console.error('❌ Transcription error:', err)
    }
  }
  
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
    
    setIsRecording(false)
    console.log('✅ Stopped')
  }, [])
  
  /**
   * Detect codes from text
   */
  const detectCodesFromText = async (text) => {
    const lower = text.toLowerCase()
    
    const keywords = {
      'diabetes': 'diabetes',
      'hypertension': 'hypertension',
      'fracture': 'fracture',
      'asthma': 'asthma'
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
              confidence: 0.85
            })
          }
        } catch (err) {
          console.error('Error detecting:', err)
        }
        break
      }
    }
  }
  
  const addDetectedCode = (code) => {
    setDetectedCodes(prev => {
      const exists = prev.some(c => c.code === code.code)
      if (exists) return prev
      return [...prev, { ...code, confirmed: false }]
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
    detectedCodes,
    error,
    startRecording,
    stopRecording,
    confirmCode,
    removeCode,
    clearAll
  }
}
