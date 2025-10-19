// ICD Suggest & Specifier Tray - Main App Component
// Apple-inspired minimal design with floating elements

import React, { useState, useEffect, useRef } from 'react'
import { Mic } from 'lucide-react'
import MainSearch from './components/MainSearch'
import SuggestionDropdown from './components/SuggestionDropdown'
import SpecifierTray from './components/SpecifierTray'
import DiagnosisDetails from './components/DiagnosisDetails'
import CPTSuggestions from './components/CPTSuggestions'
import TestableCodesPanel from './components/TestableCodesPanel'
import WalkthroughOverlay from './components/WalkthroughOverlay'
import TranscriptionChat from './components/TranscriptionChat'
import CodeRefinementModal from './components/CodeRefinementModal'
import { useICDSuggestions } from './hooks/useICDSuggestions'
import { useICDSpecifiers } from './hooks/useICDSpecifiers'
import { useDiagnosisDetails } from './hooks/useDiagnosisDetails'
import { useCPTSuggestions } from './hooks/useCPTSuggestions'

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

function App() {
  // State for the main input value
  const [inputValue, setInputValue] = useState('')
  
  // State for the currently selected suggestion
  const [selectedSuggestion, setSelectedSuggestion] = useState(null)
  
  // State for showing/hiding the dropdown
  const [showDropdown, setShowDropdown] = useState(false)
  
  // State for the currently highlighted suggestion index
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  
  // State for selected specifiers
  const [selectedSpecifiers, setSelectedSpecifiers] = useState({})
  
  // State for confirmed diagnosis
  const [confirmedDiagnosis, setConfirmedDiagnosis] = useState(null)
  
  // State for code refinement
  const [refinementData, setRefinementData] = useState(null)
  const [showRefinement, setShowRefinement] = useState(false)
  
  // State for walkthrough step
  const [walkthroughStep, setWalkthroughStep] = useState(null)
  
  // State for transcription panel visibility
  const [showTranscription, setShowTranscription] = useState(false)
  
  // Ref for the search container to handle click outside
  const searchContainerRef = useRef(null)
  
  // Custom hooks for API calls
  const { 
    suggestions, 
    completion, 
    loading: suggestionsLoading, 
    error: suggestionsError,
    fetchSuggestions 
  } = useICDSuggestions()
  
  const { 
    specifiers, 
    loading: specifiersLoading,
    fetchSpecifiers 
  } = useICDSpecifiers()
  
  // Hook for diagnosis details (only active when confirmed)
  const { 
    details, 
    loading: detailsLoading, 
    error: detailsError 
  } = useDiagnosisDetails(confirmedDiagnosis?.code)
  
  // Hook for CPT suggestions (only active when ICD is confirmed)
  const {
    cptSuggestions,
    loading: cptLoading,
    error: cptError
  } = useCPTSuggestions(confirmedDiagnosis?.code)
  
  // =============================================================================
  // EFFECTS
  // =============================================================================
  
  // Fetch suggestions when input changes
  useEffect(() => {
    if (inputValue.trim() && !selectedSuggestion) {
      fetchSuggestions(inputValue)
      setShowDropdown(true)
    } else {
      setShowDropdown(false)
      if (!inputValue.trim()) {
        setSelectedSuggestion(null)
      }
    }
  }, [inputValue, fetchSuggestions, selectedSuggestion])
  
  // Fetch specifiers when a suggestion is selected
  useEffect(() => {
    if (selectedSuggestion?.code) {
      fetchSpecifiers(selectedSuggestion.code)
    }
  }, [selectedSuggestion, fetchSpecifiers])
  
  // Update walkthrough step based on current state
  useEffect(() => {
    if (cptLoading) {
      setWalkthroughStep('cpt_loading')
    } else if (confirmedDiagnosis && cptSuggestions.length > 0) {
      setWalkthroughStep('cpt_results')
    } else if (confirmedDiagnosis) {
      setWalkthroughStep('locked')
    } else if (selectedSuggestion && Object.keys(specifiers).length > 0) {
      setWalkthroughStep('specifiers')
    } else if (selectedSuggestion) {
      setWalkthroughStep('selected')
    } else if (suggestionsLoading) {
      setWalkthroughStep('searching')
    } else {
      setWalkthroughStep(null)
    }
  }, [suggestionsLoading, selectedSuggestion, specifiers, confirmedDiagnosis, cptLoading, cptSuggestions])
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setShowDropdown(false)
        setHighlightedIndex(-1)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])
  
  // =============================================================================
  // EVENT HANDLERS
  // =============================================================================
  
  // Handle input changes
  const handleInputChange = (value) => {
    setInputValue(value)
    setHighlightedIndex(-1)
    // Clear selected suggestion when user starts typing again
    if (selectedSuggestion) {
      setSelectedSuggestion(null)
      setSelectedSpecifiers({})
    }
  }
  
  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion) => {
    setSelectedSuggestion(suggestion)
    setInputValue(suggestion.label)
    setShowDropdown(false) // Hide dropdown immediately after selection
    setHighlightedIndex(-1)
    setSelectedSpecifiers({}) // Reset specifiers when new suggestion is selected
    setConfirmedDiagnosis(null) // Reset confirmed diagnosis
  }
  
  // Handle diagnosis confirmation
  const handleDiagnosisConfirm = (suggestion, specifiers) => {
    setConfirmedDiagnosis({
      suggestion,
      specifiers,
      code: suggestion.code
    })
  }
  
  // Handle CPT code click - trigger refinement
  const handleCPTClick = async (cpt) => {
    if (!confirmedDiagnosis) return
    
    console.log('🔬 Refining pair:', confirmedDiagnosis.code, '+', cpt.code)
    
    try {
      const response = await fetch('/api/refine/icd-cpt-pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          icd_code: confirmedDiagnosis.code,
          cpt_code: cpt.code
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Refinement data:', data)
        setRefinementData(data)
        setShowRefinement(true)
      }
    } catch (err) {
      console.error('❌ Refinement error:', err)
    }
  }
  
  // Handle closing diagnosis details
  const handleCloseDetails = () => {
    setConfirmedDiagnosis(null)
    setShowRefinement(false)
    setRefinementData(null)
  }
  
  // Handle codes detected from voice transcription
  const handleTranscriptionCodeDetected = (code) => {
    console.log('Voice detected code:', code)
    
    // Auto-fill the search if it's an ICD code
    if (code.type === 'ICD' && code.description) {
      setInputValue(code.description)
      fetchSuggestions(code.description)
    }
  }
  
  // Handle test code selection from panel
  const handleTestCodeSelect = (testCode) => {
    // Set the input value to trigger search
    setInputValue(testCode.title)
    // Wait a moment then select the code
    setTimeout(() => {
      const suggestion = {
        code: testCode.code,
        label: testCode.title,
        title: testCode.title,
        category: testCode.category
      }
      handleSuggestionSelect(suggestion)
    }, 500)
  }
  
  // Handle keyboard navigation
  const handleKeyDown = (event) => {
    if (!showDropdown || suggestions.length === 0) return
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        )
        break
        
      case 'ArrowUp':
        event.preventDefault()
        setHighlightedIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        )
        break
        
      case 'Enter':
        event.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSuggestionSelect(suggestions[highlightedIndex])
        }
        break
        
      case 'Escape':
        setShowDropdown(false)
        setHighlightedIndex(-1)
        break
        
      case 'Tab':
        if (completion && completion.toLowerCase().startsWith(inputValue.toLowerCase())) {
          event.preventDefault()
          setInputValue(completion)
        }
        break
    }
  }
  
  // =============================================================================
  // RENDER
  // =============================================================================
  
  return (
    <div className="min-h-screen font-['SF_Pro_Display',_Segoe_UI,_sans-serif] py-12">
      {/* Animated medical icons background */}
      <div className="medical-icons-bg">
        <div className="medical-icon" style={{ left: '10%', top: '15%', animationDelay: '0s' }}>🏥</div>
        <div className="medical-icon" style={{ left: '85%', top: '20%', animationDelay: '2s' }}>⚕️</div>
        <div className="medical-icon" style={{ left: '15%', top: '70%', animationDelay: '4s' }}>💊</div>
        <div className="medical-icon" style={{ left: '80%', top: '75%', animationDelay: '6s' }}>🩺</div>
        <div className="medical-icon" style={{ left: '50%', top: '10%', animationDelay: '1s' }}>💉</div>
        <div className="medical-icon" style={{ left: '30%', top: '85%', animationDelay: '3s' }}>🔬</div>
        <div className="medical-icon" style={{ left: '70%', top: '50%', animationDelay: '5s' }}>❤️</div>
        <div className="medical-icon" style={{ left: '20%', top: '40%', animationDelay: '7s' }}>🧬</div>
      </div>
      
      {/* Container for all content */}
      <div className="max-w-6xl mx-auto px-4 relative z-10">
        {/* Main Search Interface - iOS 20 Glassy Style - Centered */}
        <div ref={searchContainerRef} className="max-w-xl w-full mx-auto relative">
          <MainSearch
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          isDropdownOpen={showDropdown}
          loading={suggestionsLoading}
          selectedSuggestion={selectedSuggestion}
          selectedSpecifiers={selectedSpecifiers}
        />
        
        {/* Suggestion Dropdown or Specifier Tray */}
        {showDropdown && !selectedSuggestion && (
          <SuggestionDropdown
            suggestions={suggestions}
            highlightedIndex={highlightedIndex}
            onSelect={handleSuggestionSelect}
            loading={suggestionsLoading}
            error={suggestionsError}
            completion={completion}
            inputValue={inputValue}
          />
        )}
        
        {/* Floating Specifier Tray - Replaces dropdown after selection */}
        {selectedSuggestion && !confirmedDiagnosis && (
          <SpecifierTray
            selectedSuggestion={selectedSuggestion}
            specifiers={specifiers}
            loading={specifiersLoading}
            isOpen={!!selectedSuggestion}
            selectedSpecifiers={selectedSpecifiers}
            onSpecifierSelect={setSelectedSpecifiers}
            onConfirm={handleDiagnosisConfirm}
          />
        )}
        </div>
        
        {/* CPT Suggestions - AI-powered medical linking (Now centered below search) */}
        {confirmedDiagnosis && (
        <CPTSuggestions
          icdCode={confirmedDiagnosis.code}
          icdTitle={confirmedDiagnosis.suggestion.title || confirmedDiagnosis.suggestion.label}
          cptSuggestions={cptSuggestions}
          loading={cptLoading}
          error={cptError}
          onCPTSelect={handleCPTClick}
          onClose={handleCloseDetails}
        />
        )}
      </div>
      
      {/* Testable Codes Panel - Floating button + sliding panel */}
      <TestableCodesPanel onCodeSelect={handleTestCodeSelect} />
      
      {/* Real-Time Transcription Panel - Voice-to-Code AI */}
      {showTranscription && (
        <TranscriptionChat 
          onCodeDetected={handleTranscriptionCodeDetected}
          onClose={() => setShowTranscription(false)}
        />
      )}
      
      {/* WhatsApp-style Dictation Button - Floating left side */}
      {!showTranscription && (
        <button
          onClick={() => setShowTranscription(true)}
          className="fixed left-6 bottom-6 w-16 h-16 rounded-full backdrop-blur-xl border-2 shadow-2xl
                      bg-white/10 border-white/20 hover:bg-white/15
                      flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 z-40"
          title="Open Voice Notes"
        >
          <Mic className="w-7 h-7 text-white/70" />
        </button>
      )}
      
      {/* Code Refinement Modal - ICD-CPT Pair Validation */}
      {showRefinement && refinementData && (
        <CodeRefinementModal
          refinementData={refinementData}
          onClose={() => setShowRefinement(false)}
          onSpecifierSelect={(dimension, option) => {
            console.log('Selected specifier:', dimension, option)
            // Update ICD code with specifier
            setConfirmedDiagnosis({
              ...confirmedDiagnosis,
              code: option.full_code
            })
            // Re-fetch CPT suggestions for the more specific code
            fetchCPTSuggestions(option.full_code)
            setShowRefinement(false)
          }}
        />
      )}
      
      {/* Walkthrough Overlay - Educational tips */}
      <WalkthroughOverlay 
        currentStep={walkthroughStep} 
        onClose={() => setWalkthroughStep(null)}
      />
      
      {/* Version Display - Bottom right corner */}
      <div className="fixed bottom-4 right-4 text-white/30 text-xs font-mono hover:text-white/60 transition-colors">
        v1.0.0
      </div>
    </div>
  )
}

export default App

