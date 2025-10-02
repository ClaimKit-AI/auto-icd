// ICD Suggest & Specifier Tray - Main Search Component
// Apple-inspired floating input field with engraved ICD code display

import React, { useRef, useEffect } from 'react'

// =============================================================================
// MAIN SEARCH COMPONENT
// =============================================================================

function MainSearch({ 
  value, 
  onChange, 
  onKeyDown, 
  isDropdownOpen,
  loading = false,
  selectedSuggestion = null,
  selectedSpecifiers = {},
  className = '' 
}) {
  // Reference to the input element
  const inputRef = useRef(null)
  
  // =============================================================================
  // EFFECTS
  // =============================================================================
  
  // Focus the input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])
  
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
  
  // Check if all required specifiers are selected
  const isComplete = () => {
    if (!selectedSuggestion) return false
    
    // Check if we have at least one specifier selected
    return Object.keys(selectedSpecifiers).length > 0
  }
  
  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================
  
  // Handle input changes
  const handleChange = (event) => {
    const newValue = event.target.value
    onChange(newValue)
  }
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  const finalICDCode = generateFinalICDCode()
  
  return (
    <div className={`relative ${className}`}>
      {/* Title Section */}
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          ICD-10-CM Diagnosis Assistant
        </h1>
        <p className="text-gray-600 text-lg">
          Search and build accurate ICD-10-CM codes with specifiers
        </p>
      </div>
      
      {/* Main Input Field - iOS 20 Glassy Style */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="Enter diagnosis (e.g., diabetes, hypertension)"
          value={value}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          className={`
            glass-input w-full h-14 px-5 text-lg rounded-2xl
            backdrop-blur-xl bg-white/20 border border-white/30
            shadow-2xl shadow-blue-500/10
            placeholder:text-gray-500 placeholder:font-medium
            focus:bg-white/30 focus:border-blue-400/50 focus:shadow-blue-500/20
            transition-all duration-300 ease-out
            ${loading ? 'opacity-75' : ''}
          `}
          autoComplete="off"
          spellCheck="false"
        />
        
        {/* Final ICD Code Badge Inside Input */}
        {finalICDCode && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <div className="flex items-center gap-2.5">
              {isComplete() && (
                <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse flex-shrink-0" 
                     style={{ marginTop: '1px' }} />
              )}
              <div className={` 
                text-xs font-mono font-bold px-3 py-1.5 rounded-lg
                backdrop-blur-sm border
                flex items-center justify-center
                ${isComplete() 
                  ? 'bg-green-500/20 text-green-700 border-green-400/30' 
                  : 'bg-gray-500/20 text-gray-600 border-gray-400/30'
                }
              `}>
                {finalICDCode}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Loading Indicator */}
      {loading && !finalICDCode && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  )
}

export default MainSearch
