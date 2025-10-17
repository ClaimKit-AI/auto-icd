// Real-Time Medical Transcription Chat Component
// WhatsApp-style chat design with inline ICD code highlights
// Uses Deepgram for instant voice-to-text

import React, { useEffect, useRef } from 'react'
import { Mic, MicOff, XCircle, Send, Trash2 } from 'lucide-react'
import { useTranscription } from '../hooks/useTranscription'

/**
 * TranscriptionChat Component - WhatsApp Style
 * 
 * Features:
 * - WhatsApp-style chat bubbles
 * - Inline ICD code highlighting
 * - Dictation-style mic button
 * - Real-time transcription as you speak
 */
function TranscriptionChat({ onCodeDetected, onClose }) {
  // Use transcription hook
  const {
    isRecording,
    isConnecting,
    transcript,
    partialTranscript,
    detectedCodes,
    error,
    startRecording,
    stopRecording,
    clearAll
  } = useTranscription()
  
  // Refs for auto-scrolling
  const chatRef = useRef(null)
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [transcript, partialTranscript])
  
  // Notify parent when code is detected
  useEffect(() => {
    if (detectedCodes.length > 0 && onCodeDetected) {
      const latestCode = detectedCodes[detectedCodes.length - 1]
      if (!latestCode.notified) {
        onCodeDetected(latestCode)
        latestCode.notified = true
      }
    }
  }, [detectedCodes, onCodeDetected])
  
  /**
   * Highlight ICD codes inline with text
   */
  const highlightCodesInText = (text) => {
    if (!text || detectedCodes.length === 0) {
      return <span>{text}</span>
    }
    
    // For each detected code, highlight the trigger word in the text
    let highlightedText = text
    const parts = []
    let lastIndex = 0
    
    detectedCodes.forEach(code => {
      if (code.trigger && text.toLowerCase().includes(code.trigger)) {
        const index = text.toLowerCase().indexOf(code.trigger)
        
        if (index >= lastIndex) {
          // Add text before trigger
          if (index > lastIndex) {
            parts.push(
              <span key={`text-${lastIndex}`}>
                {text.substring(lastIndex, index)}
              </span>
            )
          }
          
          // Add highlighted trigger with ICD code
          parts.push(
            <span
              key={`code-${code.code}`}
              className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 bg-blue-500/30 border border-blue-400/40 rounded-lg text-blue-100 font-medium"
              title={code.description}
            >
              <span>{text.substring(index, index + code.trigger.length)}</span>
              <span className="font-mono text-xs bg-blue-600/40 px-1 rounded">
                {code.code}
              </span>
            </span>
          )
          
          lastIndex = index + code.trigger.length
        }
      }
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-end`}>{text.substring(lastIndex)}</span>
      )
    }
    
    return parts.length > 0 ? <>{parts}</> : <span>{text}</span>
  }
  
  return (
    <div className="fixed right-6 top-20 w-96 h-[calc(100vh-8rem)] flex flex-col z-30">
      {/* WhatsApp-style Header */}
      <div className="backdrop-blur-xl bg-gray-900/70 rounded-t-3xl border border-white/30 border-b-0 shadow-2xl px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Voice Notes</h3>
              <p className="text-green-400 text-xs font-medium flex items-center gap-1">
                {isRecording ? (
                  <>
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Recording...
                  </>
                ) : (
                  'Tap mic to start'
                )}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
          >
            <XCircle className="w-5 h-5 text-white/70" />
          </button>
        </div>
      </div>
      
      {/* WhatsApp-style Chat Area */}
      <div 
        ref={chatRef}
        className="flex-1 backdrop-blur-xl bg-gray-900/70 border-x border-white/30 shadow-2xl px-4 py-4 overflow-y-auto custom-scrollbar"
        style={{ 
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.01) 10px, rgba(255,255,255,0.01) 20px)'
        }}
      >
        {transcript || partialTranscript ? (
          <div className="space-y-3">
            {/* Final transcript messages - WhatsApp style bubbles */}
            {transcript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-gradient-to-br from-blue-600/40 to-blue-500/30 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 border border-blue-400/30 shadow-lg">
                  <p className="text-white text-base leading-relaxed">
                    {highlightCodesInText(transcript)}
                  </p>
                  <span className="text-blue-200/60 text-[10px] mt-1 block text-right">
                    {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            )}
            
            {/* Partial transcript - lighter bubble (real-time) */}
            {partialTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-blue-500/20 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 border border-blue-400/20">
                  <p className="text-blue-200 text-base leading-relaxed italic">
                    {partialTranscript}
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-4">
              <Mic className="w-10 h-10 text-white/40" />
            </div>
            <h4 className="text-white/80 text-lg font-medium mb-2">
              AI Voice Notes
            </h4>
            <p className="text-white/50 text-sm leading-relaxed mb-1">
              Tap the mic button below to start
            </p>
            <p className="text-white/30 text-xs">
              Medical codes detected automatically
            </p>
          </div>
        )}
      </div>
      
      {/* WhatsApp-style Input Area with Mic Button */}
      <div className="backdrop-blur-xl bg-gray-900/70 rounded-b-3xl border border-white/30 border-t-0 shadow-2xl px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Clear button */}
          {transcript && (
            <button
              onClick={clearAll}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-all"
              title="Clear transcript"
            >
              <Trash2 className="w-5 h-5 text-white/60" />
            </button>
          )}
          
          {/* WhatsApp-style Dictation Mic Button */}
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={isConnecting}
            className={`flex-1 h-12 rounded-full flex items-center justify-center gap-2 font-medium transition-all duration-200 ${
              isRecording
                ? 'bg-red-500/30 hover:bg-red-500/40 border border-red-400/40 text-red-200'
                : 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 hover:from-blue-500/40 hover:to-purple-500/40 border border-white/20 text-white'
            } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isConnecting ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Connecting...</span>
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-5 h-5" />
                <span>Stop Recording</span>
              </>
            ) : (
              <>
                <Mic className="w-5 h-5" />
                <span>Hold to Speak</span>
              </>
            )}
          </button>
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-xl">
            <p className="text-red-200 text-xs">{error}</p>
          </div>
        )}
        
        {/* Status hint */}
        {!error && !isRecording && (
          <p className="text-white/30 text-xs text-center mt-2">
            Transcription powered by Deepgram Nova-3
          </p>
        )}
      </div>
      
      {/* Detected Codes Summary - Minimized at bottom */}
      {detectedCodes.length > 0 && (
        <div className="mt-2 backdrop-blur-xl bg-gray-900/60 rounded-2xl border border-white/20 shadow-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-white/70 text-xs font-semibold">
                {detectedCodes.length} Code{detectedCodes.length > 1 ? 's' : ''} Detected
              </span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {detectedCodes.map((code, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-2 px-2 py-1 bg-green-500/20 border border-green-400/30 rounded-lg"
                title={code.description}
              >
                <span className="text-green-300 font-mono text-xs font-semibold">
                  {code.code}
                </span>
                <span className="text-green-200/80 text-xs max-w-[120px] truncate">
                  {code.description}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TranscriptionChat
