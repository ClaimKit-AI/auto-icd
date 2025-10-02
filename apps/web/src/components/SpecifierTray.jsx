// ICD Suggest & Specifier Tray - Specifier Tray Component
// Apple-inspired floating right panel with minimal design

import React, { useState } from 'react'

// =============================================================================
// SPECIFIER TRAY COMPONENT
// =============================================================================

function SpecifierTray({ 
  selectedSuggestion, 
  specifiers = {}, 
  loading = false,
  isOpen = false,
  selectedSpecifiers = {},
  onSpecifierSelect,
  onConfirm,
  className = ''
}) {
  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================
  
  // Handle specifier selection
  const handleSpecifierSelect = (dimension, specifier) => {
    const newSpecifiers = {
      ...selectedSpecifiers,
      [dimension]: specifier
    }
    onSpecifierSelect(newSpecifiers)
  }
  
  // Check if any specifiers are selected
  const hasSelectedSpecifiers = Object.keys(selectedSpecifiers).length > 0
  
  // Handle confirmation
  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm(selectedSuggestion, selectedSpecifiers)
    }
  }
  
  // Get dimension display name
  const getDimensionName = (dimension) => {
    const names = {
      'laterality': 'Laterality',
      'encounter': 'Encounter',
      'severity': 'Severity',
      'episode': 'Episode',
      'complication': 'Complication'
    }
    return names[dimension] || dimension.charAt(0).toUpperCase() + dimension.slice(1)
  }
  
  // =============================================================================
  // RENDER LOADING STATE
  // =============================================================================
  
  if (loading) {
    return (
      <div className={`
        absolute w-full rounded-2xl z-10 shadow-dropdown
        transition-all duration-300 ease-out
        ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        ${className}
      `} style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)'
      }}>
        <div className="flex items-center justify-center py-8">
          <div className="loading-spinner w-6 h-6" />
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER NO SPECIFIERS STATE
  // =============================================================================
  
  if (Object.keys(specifiers).length === 0) {
    return (
      <div className={`
        absolute w-full rounded-2xl z-10 shadow-dropdown
        transition-all duration-300 ease-out
        ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
        ${className}
      `} style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)'
      }}>
        <div className="text-center py-6 px-6">
          <p className="text-sm text-gray-600 mb-4">
            ✓ This ICD code is complete and doesn't require additional specifications
          </p>
          
          {/* Ultra Glassy Lock In Button - Real Glass Effect */}
          <button
            onClick={handleConfirm}
            className="group relative w-full py-4 px-6 font-semibold rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 1px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Glass shine effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <span className="relative flex items-center justify-center gap-2 text-gray-800 font-bold">
              <span className="text-xl">🔒</span>
              <span>Lock In Code</span>
            </span>
          </button>
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER SPECIFIERS
  // =============================================================================
  
  return (
    <div className={`
      absolute w-full rounded-2xl z-10 shadow-dropdown
      transition-all duration-300 ease-out float-animation
      ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}
      ${className}
    `} style={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.8)'
    }}>
      {/* Header with selected suggestion */}
      <div className="p-4 border-b border-gray-200/50">
        <div>
          <h3 className="text-lg font-medium text-gray-800">ICD Specifiers</h3>
          <p className="text-sm text-gray-600">
            {selectedSuggestion.code} - {selectedSuggestion.label}
          </p>
        </div>
      </div>
      
      {/* Specifiers by Dimension */}
      <div className="p-4 space-y-4">
        {Object.entries(specifiers).map(([dimension, specifierList]) => (
          <SpecifierSection 
            key={dimension}
            title={getDimensionName(dimension)}
            options={specifierList}
            selected={selectedSpecifiers[dimension]}
            onSelect={(specifier) => handleSpecifierSelect(dimension, specifier)}
          />
        ))}
      </div>
      
      {/* Confirmation Button - Fades in after specifier selection */}
      {hasSelectedSpecifiers && (
        <div className="p-4 border-t border-white/30">
          <button
            onClick={handleConfirm}
            className="group relative w-full py-4 px-6 font-semibold rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 8px 32px rgba(31, 38, 135, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.4), inset 0 -1px 1px rgba(0, 0, 0, 0.1)',
            }}
          >
            {/* Glass shine effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <span className="relative flex items-center justify-center gap-2 text-gray-800 font-bold">
              <span className="text-xl">✓</span>
              <span>Confirm Diagnosis</span>
            </span>
          </button>
        </div>
      )}
    </div>
  )
}

// =============================================================================
// SPECIFIER SECTION COMPONENT
// =============================================================================

function SpecifierSection({ title, options, selected, onSelect }) {
  return (
    <div className="mb-4">
      <h3 className="text-base font-medium mb-2 text-gray-800">{title}</h3>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <SpecifierChip 
            key={option.suffix} 
            label={option.label} 
            isSelected={selected?.suffix === option.suffix}
            onClick={() => onSelect(option)}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// SPECIFIER CHIP COMPONENT
// =============================================================================

function SpecifierChip({ label, isSelected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`
        specifier-chip py-2 px-4 text-sm rounded-full font-normal
        ${isSelected ? 'selected' : ''}
      `}
    >
      {label}
    </button>
  )
}

export default SpecifierTray

