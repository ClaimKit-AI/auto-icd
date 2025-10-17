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
    currentInput, // The building text from transcription
    detectedCodes,
    error,
    startRecording,
    stopRecording,
    clearAll
  } = useTranscription()
  
  // State for local editable input and messages
  const [inputText, setInputText] = React.useState('')
  const [messages, setMessages] = React.useState([])
  
  // Refs
  const chatRef = useRef(null)
  const inputRef = useRef(null)
  
  // Sync transcription to input text (when not recording, user can edit)
  React.useEffect(() => {
    if (currentInput) {
      setInputText(currentInput)
      // Focus input after transcription
      if (inputRef.current && !isRecording) {
        inputRef.current.focus()
      }
    }
  }, [currentInput, isRecording])
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [messages, partialTranscript])
  
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
   * Send message (from input)
   */
  const sendMessage = () => {
    if (!inputText.trim()) return
    
    console.log('📤 Sending message:', inputText)
    console.log('📋 With codes:', detectedCodes)
    
    // Add message to chat with associated codes
    setMessages(prev => [...prev, {
      text: inputText,
      timestamp: new Date(),
      detectedCodes: [...detectedCodes] // Copy current detected codes
    }])
    
    // Clear input and detected codes for next message
    setInputText('')
    clearAll() // This also clears currentInput in the hook
    
    console.log('✅ Message sent to chat')
  }
  
  /**
   * Handle Enter key
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }
  
  /**
   * Highlight ICD/CPT codes inline with text
   */
  const highlightCodesInText = (text, codes = []) => {
    if (!text || codes.length === 0) {
      return <span>{text}</span>
    }
    
    const parts = []
    let lastIndex = 0
    
    // For each code, find and highlight its trigger word
    codes.forEach((codeData, codeIdx) => {
      const trigger = codeData.trigger
      if (!trigger) return
      
      const lowerText = text.toLowerCase()
      const index = lowerText.indexOf(trigger.toLowerCase(), lastIndex)
      
      if (index !== -1 && index >= lastIndex) {
        // Add text before trigger
        if (index > lastIndex) {
          parts.push(
            <span key={`text-${lastIndex}`}>
              {text.substring(lastIndex, index)}
            </span>
          )
        }
        
        // Add highlighted trigger with code badge
        parts.push(
          <span
            key={`code-${codeIdx}`}
            className={`inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-lg font-medium ${
              codeData.type === 'ICD'
                ? 'bg-blue-500/40 border border-blue-400/50 text-blue-100'
                : 'bg-purple-500/40 border border-purple-400/50 text-purple-100'
            }`}
            title={codeData.description}
          >
            <span className="capitalize">{text.substring(index, index + trigger.length)}</span>
            <span className="font-mono text-xs bg-white/20 px-1.5 py-0.5 rounded">
              {codeData.code}
            </span>
          </span>
        )
        
        lastIndex = index + trigger.length
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
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Close if clicking the overlay (not the chat window)
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      {/* Chat Window Container - 80% width, centered, WhatsApp style */}
      <div 
        className="w-[80%] max-w-4xl h-[80vh] flex flex-col shadow-2xl transform transition-all duration-300 ease-out scale-100"
        onClick={(e) => e.stopPropagation()}
      >
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
        {messages.length > 0 || partialTranscript ? (
          <div className="space-y-3">
            {/* Sent messages - WhatsApp style bubbles with inline code highlights */}
            {messages.map((msg, i) => (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] bg-gradient-to-br from-blue-600/40 to-blue-500/30 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 border border-blue-400/30 shadow-lg">
                  <p className="text-white text-base leading-relaxed">
                    {highlightCodesInText(msg.text, msg.detectedCodes || [])}
                  </p>
                  <div className="flex items-center justify-between gap-2 mt-2">
                    {msg.detectedCodes && msg.detectedCodes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.detectedCodes.map((code, ci) => (
                          <span key={ci} className="text-[10px] text-blue-200/70 font-mono">
                            {code.type}: {code.code}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="text-blue-200/60 text-[10px] ml-auto">
                      {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {/* Partial transcript preview - lighter bubble (real-time) */}
            {partialTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-blue-500/20 backdrop-blur-sm rounded-2xl rounded-tr-sm px-4 py-3 border border-blue-400/20">
                  <p className="text-blue-200 text-base leading-relaxed italic flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
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
              Tap the mic to dictate or type below
            </p>
            <p className="text-white/30 text-xs">
              Medical codes detected automatically
            </p>
          </div>
        )}
      </div>
      
      {/* WhatsApp-style Input Area */}
      <div className="backdrop-blur-xl bg-gray-900/70 rounded-b-3xl border border-white/30 border-t-0 shadow-2xl px-4 py-4">
        {/* Input Box with Mic and Send */}
        <div className="flex items-end gap-3">
          {/* Text Input - Editable transcript */}
          <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 px-4 py-3 min-h-[48px] max-h-32 overflow-y-auto relative">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Tap mic to dictate or type here..."
              className="w-full bg-transparent text-white placeholder-white/40 text-base outline-none resize-none"
              rows={1}
              style={{ 
                minHeight: '24px',
                maxHeight: '96px'
              }}
            />
            
            {/* Show partial transcript as preview when not typing */}
            {!inputText && partialTranscript && (
              <div className="absolute inset-0 px-4 py-3 pointer-events-none">
                <p className="text-blue-300/60 text-base italic">
                  {partialTranscript}
                </p>
              </div>
            )}
            
            {/* Show detected codes inline in input */}
            {detectedCodes.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {detectedCodes.map((code, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/30 border border-blue-400/40 rounded-lg text-xs"
                  >
                    <span className="text-blue-300 font-mono font-semibold">{code.code}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          
          {/* WhatsApp-style Mic/Send Button */}
          {inputText.trim() ? (
            <button
              onClick={sendMessage}
              className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500/40 to-green-600/40 hover:from-green-500/50 hover:to-green-600/50 border border-green-400/40 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
              title="Send message"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isConnecting}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg ${
                isRecording
                  ? 'bg-red-500/40 hover:bg-red-500/50 border border-red-400/40'
                  : 'bg-gradient-to-br from-blue-500/40 to-purple-500/40 hover:from-blue-500/50 hover:to-purple-500/50 border border-blue-400/40'
              } ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={isRecording ? 'Stop recording' : 'Start dictation'}
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : isRecording ? (
                <MicOff className="w-5 h-5 text-white" />
              ) : (
                <Mic className="w-6 h-6 text-white" />
              )}
            </button>
          )}
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mt-2 px-3 py-2 bg-red-500/20 border border-red-500/30 rounded-xl">
            <p className="text-red-200 text-xs">{error}</p>
          </div>
        )}
        
        {/* Status hint */}
        {!error && !isRecording && !inputText && (
          <p className="text-white/30 text-xs text-center mt-2">
            Transcription powered by Deepgram Nova-3 • Tap mic or type
          </p>
        )}
      </div>
      </div>
    </div>
  )
}

export default TranscriptionChat
