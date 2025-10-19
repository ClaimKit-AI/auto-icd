// Code Refinement Modal
// Shows ICD-CPT pair validation + specifier suggestions
// Agent-powered refinement workflow

import React from 'react'
import { CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react'

/**
 * Code Refinement Modal
 * 
 * Shows when user clicks a CPT code
 * Displays pair validation and suggests ICD specifiers for precision
 */
function CodeRefinementModal({ refinementData, onClose, onSpecifierSelect }) {
  if (!refinementData) return null
  
  const { icd, cpt, pair_score, verdict, specifier_suggestions, recommendations } = refinementData
  
  // Verdict styling
  const verdictStyles = {
    'EXCELLENT': { bg: 'bg-green-500/20', border: 'border-green-400/40', text: 'text-green-300', icon: CheckCircle },
    'GOOD': { bg: 'bg-blue-500/20', border: 'border-blue-400/40', text: 'text-blue-300', icon: CheckCircle },
    'ACCEPTABLE': { bg: 'bg-yellow-500/20', border: 'border-yellow-400/40', text: 'text-yellow-300', icon: AlertTriangle },
    'REVIEW_NEEDED': { bg: 'bg-red-500/20', border: 'border-red-400/40', text: 'text-red-300', icon: AlertTriangle }
  }
  
  const style = verdictStyles[verdict] || verdictStyles['ACCEPTABLE']
  const VerdictIcon = style.icon
  
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[90%] max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900/80 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl">
        
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/90 backdrop-blur-xl border-b border-white/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-white text-xl font-semibold">Code Pair Refinement</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <XCircle className="w-5 h-5 text-white/70" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Pair Score */}
          <div className={`${style.bg} ${style.border} border rounded-2xl p-5`}>
            <div className="flex items-center gap-3 mb-3">
              <VerdictIcon className={`w-6 h-6 ${style.text}`} />
              <div>
                <h3 className={`${style.text} font-semibold text-lg`}>{verdict.replace('_', ' ')}</h3>
                <p className="text-white/60 text-sm">Pair Appropriateness: {(pair_score * 100).toFixed(0)}%</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-white/50 text-xs mb-1">ICD Code</p>
                <p className="text-white font-mono font-semibold">{icd.code}</p>
                <p className="text-white/70 text-sm mt-1">{icd.title}</p>
                <p className={`text-xs mt-2 ${icd.verification.verdict?.includes('APPROVE') ? 'text-green-300' : 'text-yellow-300'}`}>
                  {icd.verification.verdict}
                </p>
              </div>
              
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-white/50 text-xs mb-1">CPT Code</p>
                <p className="text-white font-mono font-semibold">{cpt.code}</p>
                <p className="text-white/70 text-sm mt-1">{cpt.display || cpt.short_description}</p>
                <p className={`text-xs mt-2 ${cpt.validation.verdict?.includes('APPROVE') ? 'text-green-300' : 'text-yellow-300'}`}>
                  {cpt.validation.verdict}
                </p>
              </div>
            </div>
          </div>
          
          {/* Specifier Suggestions */}
          {specifier_suggestions && specifier_suggestions.length > 0 && (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/20 p-5">
              <h3 className="text-white font-semibold text-lg mb-3 flex items-center gap-2">
                🔧 Refine ICD Code with Specifiers
                <span className="text-blue-300 text-sm font-normal">(Click to improve accuracy)</span>
              </h3>
              
              <div className="space-y-4">
                {specifier_suggestions.map((spec, i) => (
                  <div key={i} className="bg-white/5 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-white capitalize font-medium">{spec.dimension}</h4>
                      <span className="text-white/50 text-xs">{spec.options.length} options</span>
                    </div>
                    
                    <p className="text-white/60 text-sm mb-3 italic">💡 {spec.why}</p>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {spec.options.map((option, oi) => (
                        <button
                          key={oi}
                          onClick={() => onSpecifierSelect && onSpecifierSelect(spec.dimension, option)}
                          className="flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-blue-500/20 border border-white/10 hover:border-blue-400/40 rounded-xl transition-all text-left group"
                        >
                          <div>
                            <p className="text-white text-sm font-medium">{option.label}</p>
                            <p className="text-white/40 text-xs font-mono mt-1">{option.full_code}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-blue-300 transition-colors" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Recommendations */}
          {recommendations && recommendations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-white font-semibold">💡 Agent Recommendations</h3>
              {recommendations.map((rec, i) => (
                <div key={i} className="bg-white/5 rounded-xl border border-white/10 p-4">
                  <div className="flex items-start gap-3">
                    <span className={`text-sm font-semibold ${
                      rec.priority === 'high' ? 'text-orange-300' : 'text-blue-300'
                    }`}>
                      {rec.priority === 'high' ? '!' : 'i'}
                    </span>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{rec.message}</p>
                      {rec.benefit && (
                        <p className="text-white/60 text-xs mt-1">✨ {rec.benefit}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-900/90 backdrop-blur-xl border-t border-white/20 px-6 py-4">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-blue-500/30 to-purple-500/30 hover:from-blue-500/40 hover:to-purple-500/40 text-white rounded-xl px-4 py-3 font-medium transition-all border border-white/20"
          >
            Close
          </button>
        </div>
        
      </div>
    </div>
  )
}

export default CodeRefinementModal

