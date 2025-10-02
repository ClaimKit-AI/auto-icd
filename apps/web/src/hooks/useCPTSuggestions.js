// CPT Suggestions Hook
// Fetches medically appropriate CPT procedures for a selected ICD diagnosis

import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for fetching CPT suggestions based on ICD code
 * @param {string} icdCode - ICD diagnosis code
 * @returns {Object} Hook state and methods
 */
export function useCPTSuggestions(icdCode) {
  // State for CPT suggestions
  const [cptSuggestions, setCptSuggestions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // Get API base URL from environment or use default
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'
  
  // Fetch CPT suggestions for ICD code
  const fetchCPTForICD = useCallback(async (code) => {
    if (!code) {
      setCptSuggestions([])
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`${API_BASE}/api/icd/${code}/cpt?limit=5`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      setCptSuggestions(data.suggested_cpt || [])
      
    } catch (err) {
      console.error('❌ Error fetching CPT suggestions:', err)
      setError(err.message)
      setCptSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [API_BASE])
  
  // Fetch when ICD code changes
  useEffect(() => {
    if (icdCode) {
      fetchCPTForICD(icdCode)
    } else {
      setCptSuggestions([])
      setError(null)
    }
  }, [icdCode, fetchCPTForICD])
  
  return {
    cptSuggestions,    // Array of CPT procedure suggestions
    loading,           // Loading state
    error,             // Error message
    refetch: fetchCPTForICD  // Manual refetch function
  }
}

