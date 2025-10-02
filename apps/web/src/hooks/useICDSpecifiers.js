// ICD Suggest & Specifier Tray - ICD Specifiers Hook
// This custom hook handles fetching ICD code specifiers from the API

import { useState, useCallback } from 'react'

// =============================================================================
// CUSTOM HOOK: useICDSpecifiers
// =============================================================================

export function useICDSpecifiers() {
  // State for specifiers data
  const [specifiers, setSpecifiers] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Get API base URL from environment or use default
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
  
  // =============================================================================
  // FETCH SPECIFIERS FUNCTION
  // =============================================================================
  
  const fetchSpecifiers = useCallback(async (code) => {
    // Don't fetch if code is empty
    if (!code || code.trim().length === 0) {
      setSpecifiers({})
      setError(null)
      return
    }
    
    // Set loading state
    setLoading(true)
    setError(null)
    
    try {
      // Make API request to ranges endpoint
      const response = await fetch(`${API_BASE}/api/ranges/${encodeURIComponent(code)}`, {
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
      
      // Update state with new specifiers
      setSpecifiers(data.specifiers || {})
      
      // Log performance for debugging
      if (data.latency_ms > 50) {
        console.warn(`🐌 Slow specifiers response: ${data.latency_ms}ms for "${code}"`)
      }
      
    } catch (err) {
      // Handle errors
      console.error('❌ Error fetching specifiers:', err)
      setError(err.message)
      setSpecifiers({})
    } finally {
      // Always clear loading state
      setLoading(false)
    }
  }, [API_BASE])
  
  // =============================================================================
  // RETURN HOOK INTERFACE
  // =============================================================================
  
  return {
    specifiers,        // Object containing specifiers organized by dimension
    loading,          // Boolean indicating if request is in progress
    error,            // Error message if request failed
    fetchSpecifiers,  // Function to fetch specifiers
  }
}

