// Testable Codes Panel - Shows demo-ready codes with AI embeddings
// Helps users quickly test working scenarios

import React, { useState, useEffect } from 'react'

/**
 * TestableCodesPanel Component
 * Shows a floating panel with codes that have AI embeddings and work well
 */
function TestableCodesPanel({ onCodeSelect, className = '' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [testableCode, setTestableCodes] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  
  // Load testable codes from JSON
  useEffect(() => {
    // In production, fetch from API. For now, use hardcoded list
    const codes = [
      // Infectious Diseases
      { code: 'B99.9', title: 'Unspecified Infectious Disease', category: 'Infectious', cpt_count: 5 },
      { code: 'A04.9', title: 'Bacterial Intestinal Infection', category: 'Infectious', cpt_count: 3 },
      { code: 'A41.9', title: 'Sepsis, Unspecified', category: 'Infectious', cpt_count: 1 },
      
      // Injuries & Fractures (Best coverage)
      { code: 'S42.001A', title: 'Fracture Of Right Clavicle, Initial', category: 'Injuries', cpt_count: 5 },
      { code: 'S52.501A', title: 'Fracture Of Right Radius, Initial', category: 'Injuries', cpt_count: 5 },
      { code: 'S52.502A', title: 'Fracture Of Left Radius, Initial', category: 'Injuries', cpt_count: 5 },
      { code: 'S62.001A', title: 'Fracture Of Right Wrist, Initial', category: 'Injuries', cpt_count: 5 },
      { code: 'S72.001A', title: 'Fracture Of Right Femur Neck, Initial', category: 'Injuries', cpt_count: 5 },
      { code: 'S72.002A', title: 'Fracture Of Left Femur Neck, Initial', category: 'Injuries', cpt_count: 5 },
      { code: 'S82.001A', title: 'Fracture Of Right Patella, Initial', category: 'Injuries', cpt_count: 5 },
      
      // Respiratory
      { code: 'J22', title: 'Acute Lower Respiratory Infection', category: 'Respiratory', cpt_count: 4 },
      { code: 'J40', title: 'Bronchitis', category: 'Respiratory', cpt_count: 2 },
      { code: 'J18.9', title: 'Pneumonia, Unspecified', category: 'Respiratory', cpt_count: 1 },
      
      // Genitourinary
      { code: 'N20.0', title: 'Calculus Of Kidney', category: 'Genitourinary', cpt_count: 4 },
      { code: 'N17.9', title: 'Acute Kidney Failure', category: 'Genitourinary', cpt_count: 2 },
      { code: 'N18.4', title: 'Chronic Kidney Disease, Stage 4', category: 'Genitourinary', cpt_count: 2 },
      
      // Mental Health
      { code: 'F32.1', title: 'Major Depression, Moderate', category: 'Mental Health', cpt_count: 5 },
      { code: 'F33.1', title: 'Recurrent Depression, Moderate', category: 'Mental Health', cpt_count: 5 },
      
      // Endocrine
      { code: 'E03.9', title: 'Hypothyroidism, Unspecified', category: 'Endocrine', cpt_count: 2 },
      { code: 'E11.21', title: 'Type 2 Diabetes With Nephropathy', category: 'Endocrine', cpt_count: 1 },
      
      // Digestive
      { code: 'K80.20', title: 'Gallbladder Calculus', category: 'Digestive', cpt_count: 5 },
      
      // Symptoms
      { code: 'R06.00', title: 'Dyspnea, Unspecified', category: 'Symptoms', cpt_count: 3 },
    ];
    
    setTestableCodes(codes);
  }, []);
  
  // Filter by category
  const filteredCodes = selectedCategory === 'All' 
    ? testableCode 
    : testableCode.filter(c => c.category === selectedCategory);
  
  // Get unique categories
  const categories = ['All', ...new Set(testableCode.map(c => c.category))];
  
  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95"
        style={{
          background: 'rgba(59, 130, 246, 0.9)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4)'
        }}
        title="View demo-ready test codes"
      >
        <div className="flex items-center gap-2 text-white font-bold">
          <span className="text-2xl">🧪</span>
          {!isOpen && <span className="hidden sm:inline">Test Codes</span>}
        </div>
      </button>
      
      {/* Sliding Panel */}
      {isOpen && (
        <div className="fixed inset-y-0 right-0 w-96 z-40 transform transition-transform duration-300">
          <div 
            className="h-full overflow-y-auto shadow-2xl border-l border-white/30"
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(30px)',
            }}
          >
            {/* Header */}
            <div className="sticky top-0 p-4 border-b border-gray-200" style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
            }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <span className="text-2xl">🧪</span>
                  <span>Demo Test Codes</span>
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              <p className="text-xs text-gray-600 mb-3">
                ✅ These codes have AI embeddings and validated CPT suggestions
              </p>
              
              {/* Category Filter */}
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 text-xs rounded-full transition-all ${ 
                      selectedCategory === cat
                        ? 'bg-blue-500 text-white font-semibold'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Code List */}
            <div className="p-4 space-y-2">
              {filteredCodes.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No codes in this category</p>
              ) : (
                filteredCodes.map((code) => (
                  <button
                    key={code.code}
                    onClick={() => {
                      onCodeSelect && onCodeSelect(code);
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all duration-200 group"
                    style={{
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-bold text-blue-700 text-sm">
                            {code.code}
                          </span>
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">
                            {code.cpt_count} CPTs
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 leading-tight">
                          {code.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {code.category}
                        </p>
                      </div>
                      <div className="ml-2 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        →
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {/* Footer */}
            <div className="sticky bottom-0 p-4 border-t border-gray-200 text-center text-xs text-gray-600" style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
            }}>
              <p>Click any code to test it instantly</p>
              <p className="text-gray-500 mt-1">
                ✨ {filteredCodes.length} codes ready for demo
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/20 z-30 backdrop-blur-sm"
        />
      )}
    </>
  )
}

export default TestableCodesPanel

