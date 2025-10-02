// ICD Suggest & Specifier Tray - Diagnosis Details Hook
// Custom hook for fetching comprehensive diagnosis information

import { useState, useEffect, useCallback } from 'react'

// =============================================================================
// CUSTOM HOOK: useDiagnosisDetails
// =============================================================================

/**
 * Custom hook for fetching detailed diagnosis information
 * @param {string} code - ICD code to fetch details for
 * @returns {Object} Hook state and methods
 */
export function useDiagnosisDetails(code) {
  // State for diagnosis details
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  // =============================================================================
  // FETCH FUNCTION
  // =============================================================================
  
  const fetchDetails = useCallback(async (icdCode) => {
    if (!icdCode) {
      setDetails(null)
      return
    }
    
    // Since we don't have a /api/details endpoint yet, we'll just set details to true
    // The DiagnosisDetails component will use the real data from selectedSuggestion
    setLoading(true)
    setError(null)
    
    try {
      // Simulate a brief loading state for UX
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Set details to an empty object - DiagnosisDetails component will use selectedSuggestion data
      setDetails({})
      
    } catch (err) {
      console.error('❌ Error loading diagnosis details:', err)
      setError(err.message)
      setDetails(null)
    } finally {
      setLoading(false)
    }
  }, [])
  
  // =============================================================================
  // EFFECTS
  // =============================================================================
  
  // Fetch details when code changes
  useEffect(() => {
    if (code) {
      fetchDetails(code)
    } else {
      setDetails(null)
      setError(null)
    }
  }, [code, fetchDetails])
  
  // =============================================================================
  // RETURN HOOK INTERFACE
  // =============================================================================
  
  return {
    details,           // Diagnosis details object
    loading,           // Loading state
    error,             // Error message
    refetch: fetchDetails  // Manual refetch function
  }
}
