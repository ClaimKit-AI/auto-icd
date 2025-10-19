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
  const API_BASE = ''
  
  // =============================================================================
  // FETCH SUGGESTIONS FUNCTION
  // =============================================================================
  
  const fetchSuggestions = useCallback(async (query, useAgentSearch = true) => {
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
      // USE AGENTS if query is complete sentence/phrase (intelligent search!)
      if (useAgentSearch && query.split(' ').length >= 2) {
        console.log('🤖 Using AI agents for:', query)
        
        const agentResponse = await fetch(`${API_BASE}/api/agents/extract-codes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: query })
        })
        
        if (agentResponse.ok) {
          const agentData = await agentResponse.json()
          
          if (agentData.success && agentData.codes.length > 0) {
            console.log(`✅ Agents found ${agentData.codes.length} codes with validation`)
            
            // Convert agent codes to suggestion format
            const agentSuggestions = agentData.codes.map(code => ({
              code: code.code,
              label: code.description,
              score: code.confidence || code.final_score,
              verified: code.verified || code.validated_by,
              agent_validated: true,
              clinical_note: code.clinical_note,
              suggestions: code.suggestions
            }))
            
            setSuggestions(agentSuggestions)
            setCompletion(agentData.clinical_summary?.clinical_note || '')
            setLoading(false)
            return
          }
        }
        
        console.log('⚠️  Agent search failed, falling back to direct search')
      }
      
      // FALLBACK: Direct vector search (fast for single words)
      const response = await fetch(`${API_BASE}/api/suggest?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Update state with new suggestions
      setSuggestions(data.items || [])
      setCompletion(data.completion || '')
      
      // Log performance for debugging
      if (data.latency_ms > 1000) {
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

