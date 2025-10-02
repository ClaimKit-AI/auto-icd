// ICD Suggest & Specifier Tray - Diagnosis Input Component
// This component handles the main text input for diagnosis entry

import React, { useRef, useEffect } from 'react'
import { Search, Loader2 } from 'lucide-react'

// =============================================================================
// DIAGNOSIS INPUT COMPONENT
// =============================================================================

function DiagnosisInput({ 
  id, 
  value, 
  onChange, 
  onKeyDown, 
  placeholder, 
  loading = false,
  className = '',
  ...props 
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
  // EVENT HANDLERS
  // =============================================================================
  
  // Handle input changes
  const handleChange = (event) => {
    const newValue = event.target.value
    onChange(newValue)
  }
  
  // Handle input focus
  const handleFocus = () => {
    // Add focus styles or trigger any focus-related logic
    if (inputRef.current) {
      inputRef.current.classList.add('ring-2', 'ring-medical-500')
    }
  }
  
  // Handle input blur
  const handleBlur = () => {
    // Remove focus styles
    if (inputRef.current) {
      inputRef.current.classList.remove('ring-2', 'ring-medical-500')
    }
  }
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <div className={`relative ${className}`}>
      {/* Main Input Field */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`
          medical-input
          pr-12
          ${loading ? 'opacity-75' : ''}
          transition-all duration-200 ease-in-out
          hover:shadow-medium
          focus:shadow-strong
        `}
        autoComplete="off"
        spellCheck="false"
        {...props}
      />
      
      {/* Loading Indicator */}
      {loading && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <Loader2 className="w-5 h-5 text-medical-600 animate-spin" />
        </div>
      )}
      
      {/* Search Icon (when not loading) */}
      {!loading && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <Search className="w-5 h-5 text-neutral-400 transition-colors duration-200" />
        </div>
      )}
      
      {/* Input Border Animation */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none">
        <div className="absolute inset-0 rounded-2xl border-2 border-transparent bg-gradient-to-r from-medical-500 to-medical-600 opacity-0 transition-opacity duration-200 group-focus-within:opacity-100" />
      </div>
    </div>
  )
}

export default DiagnosisInput

