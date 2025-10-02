// ICD Suggest & Specifier Tray - Diagnosis Details Component
// Elegant display of comprehensive diagnosis information

import React from 'react'

// =============================================================================
// DIAGNOSIS DETAILS COMPONENT
// =============================================================================

function DiagnosisDetails({ 
  selectedSuggestion, 
  selectedSpecifiers, 
  details, 
  loading = false, 
  error = null,
  onClose,
  className = '' 
}) {
  
  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================
  
  // Generate the final ICD code with proper ICD-10-CM specifier logic
  const generateFinalICDCode = () => {
    if (!selectedSuggestion) return ''
    
    let finalCode = selectedSuggestion.code
    
    // Check if we have any specifiers to add
    const hasSpecifiers = Object.values(selectedSpecifiers).some(spec => spec?.suffix)
    
    // IMPORTANT: Only add specifiers if user has explicitly selected them
    // Many ICD codes are complete and don't need specifiers (e.g., E11.21, I10)
    if (!hasSpecifiers) {
      return finalCode // Return the code as-is if no specifiers selected
    }
    
    // Add decimal point if we have specifiers and the code doesn't already have one
    if (!finalCode.includes('.')) {
      finalCode += '.'
    }
    
    // Build specifier string in proper ICD-10-CM order
    // Only add specifiers that were explicitly selected by the user
    let specifierString = ''
    
    // 1. Laterality (4th character) - only if explicitly selected
    if (selectedSpecifiers.laterality?.suffix) {
      specifierString += selectedSpecifiers.laterality.suffix
    }
    
    // 2. Severity (5th character) - only if explicitly selected
    if (selectedSpecifiers.severity?.suffix) {
      specifierString += selectedSpecifiers.severity.suffix
    }
    
    // 3. Encounter (7th character) - only if explicitly selected
    if (selectedSpecifiers.encounter?.suffix) {
      specifierString += selectedSpecifiers.encounter.suffix
    }
    
    // 4. Episode (8th character) - only if explicitly selected
    if (selectedSpecifiers.episode?.suffix) {
      specifierString += selectedSpecifiers.episode.suffix
    }
    
    // 5. Complication (9th character) - only if explicitly selected
    if (selectedSpecifiers.complication?.suffix) {
      specifierString += selectedSpecifiers.complication.suffix
    }
    
    return finalCode + specifierString
  }
  
  // =============================================================================
  // RENDER LOADING STATE
  // =============================================================================
  
  if (loading) {
    return (
      <div className={`fade-in ${className}`}>
        <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white/60 backdrop-blur-xl border border-white/70 rounded-3xl shadow-xl p-8 text-center" style={{
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.7)'
        }}>
          <div className="flex items-center justify-center py-8">
            <div className="loading-spinner w-8 h-8" />
            <span className="ml-3 text-gray-600">Loading diagnosis details...</span>
          </div>
        </div>
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER ERROR STATE
  // =============================================================================
  
  if (error) {
    return (
      <div className={`fade-in ${className}`}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white/60 backdrop-blur-xl border border-white/70 rounded-3xl shadow-xl p-8 text-center" style={{
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.7)'
          }}>
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Details</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-xl transition-colors"
            >
              Close
            </button>
          </div>
          </div>
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER DETAILS
  // =============================================================================
  
  if (!details) {
    return null
  }
  
  const finalICDCode = generateFinalICDCode()
  
  // Use real data from selectedSuggestion since API details might not be populated
  const displayData = details || {
    description: selectedSuggestion.title || selectedSuggestion.label,
    icd_chapter: selectedSuggestion.chapter,
    icd_block: selectedSuggestion.block,
    icd_category: selectedSuggestion.category
  }
  
  return (
    <div className={`fade-in ${className}`}>
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white/60 backdrop-blur-xl border border-white/70 rounded-3xl shadow-xl overflow-hidden" style={{
          background: 'rgba(255, 255, 255, 0.6)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.7)'
        }}>
        {/* Header */}
        <div className="p-6 border-b border-white/50">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Diagnosis Details</h1>
              <p className="text-lg text-gray-700 mt-1">
                <span className="font-mono font-semibold">{finalICDCode}</span> - {selectedSuggestion.title || selectedSuggestion.label}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/30 rounded-full transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Description */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Description</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{displayData.description}</p>
          </div>
          
          {/* Synonyms - from real data */}
          {selectedSuggestion.synonyms && selectedSuggestion.synonyms.length > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Alternative Terms</h3>
              <div className="flex flex-wrap gap-2">
                {selectedSuggestion.synonyms.map((synonym, index) => (
                  <span key={index} className="px-3 py-1 bg-blue-100/50 text-blue-800 text-xs rounded-full font-medium">
                    {synonym}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Clinical Notes */}
          {displayData.clinical_notes && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Clinical Notes</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{details.clinical_notes}</p>
            </div>
          )}
          
          {/* Symptoms */}
          {details.symptoms && details.symptoms.length > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Symptoms</h3>
              <div className="flex flex-wrap gap-1">
                {details.symptoms.map((symptom, index) => (
                  <span key={index} className="px-2 py-1 bg-red-100/60 text-red-700 rounded text-xs">
                    {symptom}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Risk Factors */}
          {details.risk_factors && details.risk_factors.length > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Risk Factors</h3>
              <div className="flex flex-wrap gap-1">
                {details.risk_factors.map((factor, index) => (
                  <span key={index} className="px-2 py-1 bg-orange-100/60 text-orange-700 rounded text-xs">
                    {factor}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Complications */}
          {details.complications && details.complications.length > 0 && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Complications</h3>
              <div className="flex flex-wrap gap-1">
                {details.complications.map((complication, index) => (
                  <span key={index} className="px-2 py-1 bg-yellow-100/60 text-yellow-700 rounded text-xs">
                    {complication}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Treatment Notes */}
          {details.treatment_notes && (
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Treatment</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{details.treatment_notes}</p>
            </div>
          )}
          
          {/* Classification */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Classification</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Chapter:</span>
                <span className="ml-1 text-gray-700">{displayData.icd_chapter || selectedSuggestion.chapter || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Block:</span>
                <span className="ml-1 text-gray-700">{displayData.icd_block || selectedSuggestion.block || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Category:</span>
                <span className="ml-1 text-gray-700">{displayData.icd_category || selectedSuggestion.category || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">System:</span>
                <span className="ml-1 text-gray-700">{details.body_system || 'N/A'}</span>
              </div>
            </div>
          </div>
          
          {/* Demographics */}
          <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 border border-white/30">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Demographics</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              {/* Severity Levels */}
              <div>
                <span className="text-gray-500 block mb-1">Severity:</span>
                <div className="flex flex-wrap gap-1">
                  {details.severity_levels && details.severity_levels.length > 0 ? (
                    details.severity_levels.map((level, index) => (
                      <span key={index} className="px-1 py-0.5 bg-blue-100/60 text-blue-700 rounded text-xs">
                        {level}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </div>
              </div>
              
              {/* Age Groups */}
              <div>
                <span className="text-gray-500 block mb-1">Age Groups:</span>
                <div className="flex flex-wrap gap-1">
                  {details.age_groups && details.age_groups.length > 0 ? (
                    details.age_groups.map((age, index) => (
                      <span key={index} className="px-1 py-0.5 bg-green-100/60 text-green-700 rounded text-xs">
                        {age}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-500">N/A</span>
                  )}
                </div>
              </div>
              
              {/* Gender Preference */}
              <div>
                <span className="text-gray-500 block mb-1">Gender:</span>
                <span className="text-gray-700">{details.gender_preference || 'None'}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-3 border-t border-white/30">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-gray-500/80 hover:bg-gray-500 text-white rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}

export default DiagnosisDetails
