// ICD Suggest & Specifier Tray - Suggestion Dropdown Component
// Apple-inspired minimal dropdown with clean design

import React from 'react'

// =============================================================================
// SUGGESTION DROPDOWN COMPONENT
// =============================================================================

function SuggestionDropdown({ 
  suggestions = [], 
  highlightedIndex = -1, 
  onSelect, 
  loading = false,
  error = null,
  completion = '',
  inputValue = '',
  className = ''
}) {
  
  // =============================================================================
  // HELPER FUNCTIONS
  // =============================================================================
  
  // Check if a suggestion is highlighted
  const isHighlighted = (index) => index === highlightedIndex
  
  // Get completion text for ghost completion
  const getCompletionText = () => {
    if (!completion || !inputValue) return ''
    return completion.toLowerCase().startsWith(inputValue.toLowerCase()) 
      ? completion.substring(inputValue.length)
      : ''
  }
  
  // =============================================================================
  // RENDER LOADING STATE
  // =============================================================================
  
  if (loading) {
    return (
      <div className={`absolute w-full rounded-b-2xl z-10 shadow-dropdown ${className}`} style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)'
      }}>
        <div className="p-6 text-center">
          <div className="loading-spinner w-6 h-6 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Searching ICD codes...</p>
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER ERROR STATE
  // =============================================================================
  
  if (error) {
    return (
      <div className={`absolute w-full rounded-b-2xl z-10 shadow-dropdown ${className}`} style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)'
      }}>
        <div className="p-4 text-center">
          <p className="text-sm text-gray-800">Search Error</p>
          <p className="text-xs text-gray-600 mt-1">{error}</p>
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER EMPTY STATE
  // =============================================================================
  
  if (suggestions.length === 0) {
    return (
      <div className={`absolute w-full rounded-b-2xl z-10 shadow-dropdown ${className}`} style={{
        background: 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.8)'
      }}>
        <div className="p-6 text-center">
          <p className="text-sm text-gray-600 mb-1">No ICD codes found</p>
          <p className="text-xs text-gray-500">Try a different search term</p>
        </div>
      </div>
    )
  }
  
  // =============================================================================
  // RENDER SUGGESTIONS
  // =============================================================================
  
  return (
    <div className={`absolute w-full rounded-b-2xl z-10 shadow-dropdown ${className}`} style={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.8)'
    }}>
      {/* Suggestions List */}
      <div className="max-h-80 overflow-y-auto">
        {suggestions.map((suggestion, index) => (
          <div
            key={`${suggestion.code}-${index}`}
            className={`
              suggestion-item py-3 px-5 text-base cursor-pointer
              ${isHighlighted(index) ? 'selected' : ''}
            `}
            onClick={() => onSelect(suggestion)}
          >
            <span className="font-normal">{suggestion.code} - </span>
            <span className="font-normal">{suggestion.label}</span>
          </div>
        ))}
      </div>
      
      {/* Ghost Completion Hint */}
      {getCompletionText() && (
        <div className="px-5 py-3 border-t border-gray-200/50 rounded-b-2xl" style={{
          background: 'rgba(255, 255, 255, 0.5)'
        }}>
          <div className="flex items-center space-x-2 text-xs text-gray-600">
            <span>Press</span>
            <kbd className="px-2 py-1 rounded text-gray-700 font-mono" style={{
              background: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(0, 0, 0, 0.1)'
            }}>
              Tab
            </kbd>
            <span>to complete:</span>
            <span className="font-medium text-gray-800">
              {inputValue}
              <span className="text-gray-500">{getCompletionText()}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuggestionDropdown

