// Real-Time Medical Transcription Chat Component
// Apple iOS 18 glassy style with live speech-to-text and automatic ICD/CPT code detection
// Uses AssemblyAI for high-quality medical transcription

import React, { useEffect, useRef } from 'react'
import { Mic, MicOff, XCircle, Check, FileText, Sparkles, Radio } from 'lucide-react'
import { useTranscription } from '../hooks/useTranscription'

/**
 * TranscriptionChat Component
 * 
 * Displays a beautiful glassy chat window that:
 * 1. Captures doctor's voice in real-time
 * 2. Transcribes speech to text instantly
 * 3. Auto-detects medical terms and suggests ICD/CPT codes
 * 4. Shows codes inline with the transcription
 * 
 * @param {Function} onCodeDetected - Callback when ICD/CPT code is detected
 * @param {Function} onClose - Callback to close the panel
 */
function TranscriptionChat({ onCodeDetected, onClose }) {
  // Use custom transcription hook
  const {
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
  } = useTranscription()
  
  // Refs for auto-scrolling
  const transcriptRef = useRef(null)
  
  // Auto-scroll transcript to bottom when new text arrives
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript, partialTranscript])
  
  // Notify parent when code is detected
  useEffect(() => {
    if (detectedCodes.length > 0 && onCodeDetected) {
      const latestCode = detectedCodes[detectedCodes.length - 1]
      if (!latestCode.notified) {
        onCodeDetected(latestCode)
        // Mark as notified to avoid duplicate notifications
        latestCode.notified = true
      }
    }
  }, [detectedCodes, onCodeDetected])
  
  return (
    <div className="fixed right-6 top-20 w-96 h-[calc(100vh-8rem)] flex flex-col gap-3 z-30">
      {/* Header Card - Glassy iOS style with better contrast */}
      <div className="backdrop-blur-xl bg-gray-900/60 rounded-3xl border border-white/30 shadow-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
              isRecording 
                ? 'bg-red-500/20 animate-pulse' 
                : 'bg-blue-500/20'
            }`}>
              {isRecording ? (
                <Mic className="w-5 h-5 text-red-400" />
              ) : (
                <MicOff className="w-5 h-5 text-white/60" />
              )}
            </div>
            
            <div>
              <h3 className="text-white font-semibold text-base">Voice Transcription</h3>
              <p className="text-blue-300 text-xs font-medium">
                {isRecording ? 'Recording...' : 'Ready to record'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all duration-200"
          >
            <XCircle className="w-4 h-4 text-white/60" />
          </button>
        </div>
        
        {/* Recording Controls */}
        <div className="flex gap-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isConnecting}
              className="flex-1 bg-gradient-to-r from-blue-500/30 to-purple-500/30 hover:from-blue-500/40 hover:to-purple-500/40 
                         text-white rounded-2xl px-4 py-3 font-medium text-sm
                         transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                         border border-white/20 shadow-lg"
            >
              {isConnecting ? (
                <>
                  <div className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <Mic className="inline w-4 h-4 mr-2" />
                  Start Recording
                </>
              )}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 bg-gradient-to-r from-red-500/30 to-pink-500/30 hover:from-red-500/40 hover:to-pink-500/40 
                         text-white rounded-2xl px-4 py-3 font-medium text-sm
                         transition-all duration-200 border border-white/20 shadow-lg"
            >
              <MicOff className="inline w-4 h-4 mr-2" />
              Stop Recording
            </button>
          )}
          
          {transcript && (
            <button
              onClick={clearAll}
              className="bg-white/10 hover:bg-white/20 text-white rounded-2xl px-4 py-3 
                         transition-all duration-200 border border-white/20"
              title="Clear transcript"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
            <p className="text-red-200 text-xs">{error}</p>
          </div>
        )}
      </div>
      
      {/* Transcript Display - Scrollable chat-style with better contrast */}
      <div 
        ref={transcriptRef}
        className="flex-1 backdrop-blur-xl bg-gray-900/60 rounded-3xl border border-white/30 shadow-2xl p-5 overflow-y-auto custom-scrollbar"
      >
        {transcript || partialTranscript || isRecording ? (
          <div className="space-y-4">
            {/* Final transcript - High contrast white text */}
            {transcript && (
              <div className="text-white text-base leading-relaxed whitespace-pre-wrap font-medium">
                {transcript}
              </div>
            )}
            
            {/* Partial transcript (real-time preview) - Blue for visibility */}
            {partialTranscript && (
              <div className="text-blue-200 text-base leading-relaxed whitespace-pre-wrap italic flex items-start gap-2">
                <Radio className="w-4 h-4 text-blue-400 animate-pulse mt-1 flex-shrink-0" />
                {partialTranscript}
              </div>
            )}
            
            {/* Recording indicator when active but no text yet */}
            {isRecording && !transcript && !partialTranscript && (
              <div className="flex items-center gap-2 text-white/40 text-sm">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                Listening...
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <div className="relative">
              <Sparkles className="w-16 h-16 text-white/20 mb-4" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full blur-xl"></div>
            </div>
            <h4 className="text-white/70 text-base font-medium mb-2">
              AI Medical Transcription
            </h4>
            <p className="text-white/40 text-sm leading-relaxed">
              Start recording to transcribe speech in real-time
            </p>
            <p className="text-white/30 text-xs mt-3">
              ICD & CPT codes will be detected automatically
            </p>
          </div>
        )}
      </div>
      
      {/* Detected Codes Panel - Better contrast */}
      {detectedCodes.length > 0 && (
        <div className="backdrop-blur-xl bg-gray-900/60 rounded-3xl border border-white/30 shadow-2xl p-5 max-h-64 overflow-y-auto custom-scrollbar">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-300" />
            <h4 className="text-white font-semibold text-base">Detected Codes</h4>
            <span className="text-blue-300 text-xs font-semibold">({detectedCodes.length})</span>
          </div>
          
          <div className="space-y-2">
            {detectedCodes.map((code, index) => (
              <div
                key={index}
                className={`p-3 rounded-xl border transition-all duration-200 ${
                  code.confirmed
                    ? 'bg-green-500/20 border-green-500/30'
                    : 'bg-white/5 border-white/10 hover:bg-white/10'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        code.type === 'ICD' 
                          ? 'bg-blue-500/30 text-blue-200' 
                          : 'bg-purple-500/30 text-purple-200'
                      }`}>
                        {code.type}
                      </span>
                      <span className="text-white font-mono text-sm">{code.code}</span>
                    </div>
                    <p className="text-white/70 text-xs leading-relaxed truncate" title={code.description}>
                      {code.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300"
                          style={{ width: `${(code.confidence || 0.8) * 100}%` }}
                        />
                      </div>
                      <span className="text-white/40 text-[10px] font-mono">
                        {((code.confidence || 0.8) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-1">
                    {!code.confirmed && (
                      <button
                        onClick={() => confirmCode(code)}
                        className="w-7 h-7 rounded-lg bg-green-500/20 hover:bg-green-500/30 
                                   flex items-center justify-center transition-all duration-200"
                        title="Confirm code"
                      >
                        <Check className="w-4 h-4 text-green-300" />
                      </button>
                    )}
                    <button
                      onClick={() => removeCode(code)}
                      className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 
                                 flex items-center justify-center transition-all duration-200"
                      title="Remove code"
                    >
                      <XCircle className="w-4 h-4 text-red-300" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default TranscriptionChat

