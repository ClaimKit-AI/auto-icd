// Walkthrough Overlay - Explains what's happening at each step
// Educational overlay for demo and first-time users

import React, { useState, useEffect } from 'react'

/**
 * WalkthroughOverlay Component
 * Shows helpful explanations at each step of the workflow
 */
function WalkthroughOverlay({ 
  currentStep = null, 
  onClose,
  className = '' 
}) {
  const [isVisible, setIsVisible] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)
  
  // Show overlay when step changes
  useEffect(() => {
    if (currentStep && showOverlay) {
      setIsVisible(true)
    } else {
      setIsVisible(false)
    }
  }, [currentStep, showOverlay])
  
  // Don't render if user closed overlay
  if (!showOverlay) return null
  
  // Define step explanations
  const steps = {
    searching: {
      icon: '🔍',
      title: 'AI-Powered Search',
      description: 'System is using hybrid AI search combining traditional text matching with semantic vector search for intelligent results.',
      details: [
        '✅ Searches 67,985 ICD diagnosis codes',
        '🤖 AI embeddings understand medical terminology',
        '⚡ Real-time suggestions as you type'
      ]
    },
    
    selected: {
      icon: '✓',
      title: 'Diagnosis Selected',
      description: 'Checking if this ICD code requires additional specifiers (laterality, encounter type, severity, etc.).',
      details: [
        '📋 Loading available specifiers from database',
        '🔧 Some codes are complete (e.g., I10, E11.21)',
        '🎯 Others need modifiers (e.g., fractures need laterality)'
      ]
    },
    
    specifiers: {
      icon: '🎛️',
      title: 'Specifier Selection',
      description: 'Select additional ICD-10-CM specifiers to build the complete, billable code.',
      details: [
        '👈 Laterality: Right (1), Left (2)',
        '📅 Encounter: Initial (A), Subsequent (D), Sequela (S)',
        '📊 Severity: Mild, Moderate, Severe (if applicable)'
      ]
    },
    
    locked: {
      icon: '🔒',
      title: 'Diagnosis Locked',
      description: 'Finding medically appropriate CPT procedures for this diagnosis using AI vector search and NICE care pathway validation.',
      details: [
        '🤖 AI analyzes 5,198 CPT procedures with embeddings',
        '🛡️ Medical validation agent checks appropriateness',
        '✅ Only anatomically correct procedures approved',
        '❌ Wrong-site procedures blocked automatically'
      ]
    },
    
    cpt_loading: {
      icon: '🏥',
      title: 'Medical AI at Work',
      description: 'Running medical validation with NICE care pathway logic...',
      details: [
        '🔍 Step 1: AI vector search for similar procedures',
        '🛡️ Step 2: Anatomical site validation',
        '📋 Step 3: Medical domain checking',
        '✅ Step 4: NICE pathway compliance verification',
        '📊 Step 5: Confidence scoring (max 95%)'
      ]
    },
    
    cpt_results: {
      icon: '✅',
      title: 'CPT Procedures Validated',
      description: 'Medical validation complete. Showing only clinically appropriate, anatomically correct procedures.',
      details: [
        '✅ All suggestions passed medical validation',
        '🎯 Similarity scores show AI confidence',
        '💡 Clinical reasoning explains each match',
        '📊 Higher scores = better matches'
      ]
    },
    
    validation_blocking: {
      icon: '🛡️',
      title: 'Medical Safety Active',
      description: 'Validation agent blocked inappropriate procedures.',
      details: [
        '❌ Wrong anatomical site (e.g., radius for mandible)',
        '❌ Cross-specialty errors (e.g., cardiac for fractures)',
        '❌ Domain violations (e.g., OB for non-pregnancy)',
        '✅ Only safe, appropriate procedures shown'
      ]
    }
  }
  
  const currentStepData = steps[currentStep]
  
  if (!currentStepData || !isVisible) return null
  
  return (
    <>
      {/* Overlay backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 pointer-events-none fade-in" />
      
      {/* Walkthrough card */}
      <div className={`fixed top-4 right-4 w-96 z-50 slide-down ${className}`}>
        <div 
          className="rounded-2xl shadow-2xl border border-white/40 overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(40px)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{currentStepData.icon}</span>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    {currentStepData.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Auto-ICD System</p>
                </div>
              </div>
              <button
                onClick={() => setShowOverlay(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close walkthrough"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-4">
            <p className="text-sm text-gray-700 leading-relaxed mb-3">
              {currentStepData.description}
            </p>
            
            {/* Details list */}
            <div className="space-y-1.5">
              {currentStepData.details.map((detail, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50/80 rounded-lg p-2"
                >
                  <span className="flex-shrink-0 mt-0.5">•</span>
                  <span className="flex-1">{detail}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">
                💡 Interactive walkthrough
              </span>
              <button
                onClick={() => setShowOverlay(false)}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Hide tips
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default WalkthroughOverlay

