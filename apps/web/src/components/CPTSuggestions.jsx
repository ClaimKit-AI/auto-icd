// CPT Suggestions Component
// Shows medically appropriate CPT procedures for a selected ICD diagnosis

import React from 'react'

/**
 * CPT Suggestions Component
 * Displays AI-suggested CPT procedures based on ICD diagnosis
 */
function CPTSuggestions({ 
  icdCode,
  icdTitle,
  cptSuggestions = [],
  loading = false,
  error = null,
  onCPTSelect,
  onClose,
  className = ''
}) {
  
  // Don't render if no ICD code selected
  if (!icdCode) {
    return null
  }
  
  // Loading state - show elegant loading animation
  if (loading) {
    return (
      <div className={`fade-in ${className}`}>
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div className="bg-white/30 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl p-12" style={{
            backdropFilter: 'blur(25px) saturate(180%)',
            WebkitBackdropFilter: 'blur(25px) saturate(180%)',
          }}>
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-6">
                <div className="loading-spinner w-12 h-12" />
                <div className="absolute inset-0 flex items-center justify-center text-3xl animate-pulse">
                  🏥
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Finding Relevant Procedures</h3>
              <p className="text-sm text-gray-600">
                AI is analyzing medical procedures for your diagnosis...
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className={`fade-in ${className}`}>
        <div className="max-w-4xl mx-auto px-4 mt-6">
          <div className="bg-white/25 backdrop-blur-xl border border-white/40 rounded-2xl shadow-xl p-6" style={{
            backdropFilter: 'blur(25px) saturate(180%)',
            WebkitBackdropFilter: 'blur(25px) saturate(180%)',
          }}>
            <p className="text-sm text-red-600 text-center">⚠️ {error}</p>
          </div>
        </div>
      </div>
    )
  }
  
  // No suggestions - show message instead of hiding
  const hasNoSuggestions = !loading && !error && cptSuggestions.length === 0;
  
  return (
    <div className={`fade-in ${className}`}>
      <div className="mt-8">
        {/* ICD Diagnosis Card */}
        <div className="bg-white/30 backdrop-blur-xl border border-white/50 rounded-2xl shadow-xl p-6 mb-4" style={{
          backdropFilter: 'blur(25px) saturate(180%)',
          WebkitBackdropFilter: 'blur(25px) saturate(180%)',
        }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <span className="text-3xl">✓</span>
                <span>Locked Diagnosis</span>
              </h2>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold text-xl text-blue-700 px-4 py-2 bg-blue-100/50 rounded-xl">
                  {icdCode}
                </span>
                <span className="text-lg text-gray-800 font-medium">
                  {icdTitle}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/40 rounded-full transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        
        {/* CPT Header */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <span>Suggested Procedures (CPT)</span>
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            AI-recommended medical procedures for this diagnosis
          </p>
        </div>
        
        {/* CPT Cards Grid or No Results Message */}
        {hasNoSuggestions ? (
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-8 text-center border border-white/30">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">No Procedure Suggestions Available</h3>
            <p className="text-sm text-gray-600 mb-4">
              We don't have CPT procedure suggestions for this diagnosis yet.
            </p>
            <p className="text-xs text-gray-500">
              This typically means the CPT codes for this medical category haven't been AI-embedded yet.
              The system currently has the best coverage for surgical procedures.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {cptSuggestions.map((cpt, index) => (
            <div
              key={cpt.code || index}
              onClick={() => onCPTSelect && onCPTSelect(cpt)}
              className="group relative bg-white/25 backdrop-blur-xl border border-white/40 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
              style={{
                backdropFilter: 'blur(25px) saturate(180%)',
                WebkitBackdropFilter: 'blur(25px) saturate(180%)',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), inset 0 1px 1px rgba(255, 255, 255, 0.4)',
              }}
            >
              {/* Glass shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
              
              <div className="relative">
                {/* CPT Code Badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-blue-700 text-sm px-3 py-1 bg-blue-100/50 rounded-lg">
                    {cpt.code}
                  </span>
                  {cpt.confidence_score && (
                    <span className="text-xs text-gray-500">
                      {Math.round(cpt.confidence_score * 100)}% match
                    </span>
                  )}
                </div>
                
                {/* Procedure Name */}
                <h3 className="text-sm font-semibold text-gray-900 mb-2 leading-tight">
                  {cpt.short_description || cpt.label || cpt.display?.substring(0, 80)}
                </h3>
                
                {/* Full Description (if different) */}
                {cpt.fullDisplay && cpt.fullDisplay !== cpt.short_description && (
                  <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                    {cpt.fullDisplay}
                  </p>
                )}
                
                {/* Chapter */}
                {cpt.chapter && (
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                    <span className="px-2 py-0.5 bg-gray-100/50 rounded">
                      {cpt.chapter}
                    </span>
                  </div>
                )}
                
                {/* AI Context */}
                {cpt.clinical_context && (
                  <p className="text-xs text-blue-600 mt-2 italic">
                    💡 {cpt.clinical_context}
                  </p>
                )}
              </div>
            </div>
            ))}
          </div>
        )}
        
        {/* Info Message */}
        {!hasNoSuggestions && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              🤖 AI-powered medical linking • Click any procedure for details
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default CPTSuggestions

