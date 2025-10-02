// ICD Suggest & Specifier Tray - ICD Suggestions Hook
// This custom hook handles fetching ICD code suggestions from the API

import { useState, useCallback } from 'react'

// =============================================================================
// CUSTOM HOOK: useICDSuggestions
// =============================================================================

export function useICDSuggestions() {
  // State for suggestions data
  const [suggestions, setSuggestions] = useState([])
  const [completion, setCompletion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Get API base URL from environment or use default
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
  
  // =============================================================================
  // FETCH SUGGESTIONS FUNCTION
  // =============================================================================
  
  const fetchSuggestions = useCallback(async (query) => {
    // Don't fetch if query is empty
    if (!query || query.trim().length === 0) {
      setSuggestions([])
      setCompletion('')
      setError(null)
      return
    }
    
    // Set loading state
    setLoading(true)
    setError(null)
    
    try {
      // Make API request to suggest endpoint
      const response = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      // Parse response data
      const data = await response.json()
      
      // Update state with new suggestions
      setSuggestions(data.items || [])
      setCompletion(data.completion || '')
      
      // Log performance for debugging
      if (data.latency_ms > 100) {
        console.warn(`🐌 Slow API response: ${data.latency_ms}ms for "${query}"`)
      }
      
    } catch (err) {
      // Handle errors
      console.error('❌ Error fetching suggestions:', err)
      setError(err.message)
      setSuggestions([])
      setCompletion('')
    } finally {
      // Always clear loading state
      setLoading(false)
    }
  }, [API_BASE])
  
  // =============================================================================
  // RETURN HOOK INTERFACE
  // =============================================================================
  
  return {
    suggestions,        // Array of suggestion objects
    completion,         // Best completion text for ghost completion
    loading,           // Boolean indicating if request is in progress
    error,             // Error message if request failed
    fetchSuggestions,  // Function to fetch suggestions
  }
}

