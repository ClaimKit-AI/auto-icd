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
  className = ''
}) {
  
  // Don't render if no ICD code selected
  if (!icdCode) {
    return null
  }
  
  // Loading state - don't show, let it load silently
  if (loading) {
    return null
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
  
  // No suggestions
  if (cptSuggestions.length === 0) {
    return null
  }
  
  return (
    <div className={`fade-in ${className}`}>
      <div className="max-w-4xl mx-auto px-4 mt-6">
        {/* Header */}
        <div className="mb-3">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">🏥</span>
            <span>Suggested Procedures (CPT)</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            AI-recommended procedures for: <span className="font-mono font-semibold">{icdCode}</span> - {icdTitle}
          </p>
        </div>
        
        {/* CPT Cards Grid */}
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
        
        {/* Info Message */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-500">
            🤖 AI-powered medical linking • Click any procedure for details
          </p>
        </div>
      </div>
    </div>
  )
}

export default CPTSuggestions

