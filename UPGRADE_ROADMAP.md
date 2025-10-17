# 🚀 ClaimKit Auto-ICD Upgrade Roadmap

**Version**: 1.0.0 → 2.0.0  
**Status**: Planning & Phase 1 Implementation  
**Started**: 2025-10-17  

---

## 🎯 **Vision: From Rule-Based to Agentic Multi-Verifier**

Transform Auto-ICD from a simple embedding + 23 hardcoded rules system into a **high-speed, agentic multi-verifier architecture** with reasoning, validation, and NICE compliance.

---

## 📊 **Current State Analysis**

### ✅ **What's Working (v1.0.0)**
- Basic ICD/CPT search with embeddings
- 239 ICD codes with embeddings (0.35% coverage)
- 5,198 CPT codes with embeddings (56% coverage)
- 23 hardcoded validation rules
- Production deployment on DigitalOcean
- Frontend UI with version display

### ❌ **Critical Issues to Fix**
1. **Missing Embeddings**
   - Only 239/67,965 ICD codes have embeddings (~0.35%)
   - Only 5,198/9,942 CPT codes have embeddings (56%)
   - Sequential generation taking days/weeks

2. **Data Integrity Issues**
   - `icd_cpt_links` table is empty or not synchronized
   - Orphan references between tables
   - Missing specifiers for many codes

3. **Architecture Limitations**
   - No reasoning layer (just similarity + rules)
   - No NICE compliance verification
   - No explainable AI
   - No confidence calibration

4. **Performance Issues**
   - Embedding generation: days → should be hours
   - No parallel processing
   - No checkpointing/resume capability
   - No rate-limit safety

---

## 🗺️ **Three-Phase Upgrade Plan**

### **Phase 1: Database & Embedding Enhancement** (Week 1-2)
**Priority**: CRITICAL  
**Status**: 🟡 Starting Now

### **Phase 2: Agentic Multi-Verifier System** (Week 3-4)
**Priority**: HIGH  
**Status**: 🔴 Blocked by Phase 1

### **Phase 3: Production Optimization & Monitoring** (Week 5-6)
**Priority**: MEDIUM  
**Status**: 🔴 Blocked by Phase 2

---

## 📋 **PHASE 1: DATABASE & EMBEDDING ENHANCEMENT**

### **Objective**
Make the dataset 100% complete, consistent, and fast to process before building agents.

### **Tasks**

#### **1.1 Diagnostic & Assessment** ✅ NEXT
**File**: `apps/api/scripts/diagnose-database.js`

```javascript
// What we need to check:
- Total ICD codes vs. codes with embeddings
- Total CPT codes vs. codes with embeddings
- icd_cpt_links table: empty? outdated?
- Orphan references (links pointing to non-existent codes)
- Missing specifiers
- Data quality issues
```

**Deliverables**:
- Full diagnostic report with counts and percentages
- List of missing embeddings (ICD & CPT)
- List of orphan references
- Data quality score (0-100%)

---

#### **1.2 Parallel Embedding Generator** 🔄 IN PROGRESS
**File**: `apps/api/scripts/parallel-embedding-generator.js`

**Features**:
- ✅ Batch processing (100-200 items per batch)
- ✅ Concurrent workers (10 parallel streams)
- ✅ Progress checkpointing (resume after crashes)
- ✅ OpenAI + OpenRouter API support
- ✅ Rate-limit safety with exponential backoff
- ✅ Progress bar and ETA calculation
- ✅ Dry-run mode for testing

**Expected Performance**:
```
Current: 67,965 ICD codes × 3 sec/code = 56 hours (sequential)
Target:  67,965 ICD codes ÷ 10 workers = 6 hours (parallel)
```

**Deliverables**:
- Script that generates ALL missing embeddings in hours
- Checkpoint files for crash recovery
- Comprehensive logging
- Cost estimation before generation

---

#### **1.3 Data Integrity Validator** 📝 NEXT
**File**: `apps/api/scripts/validate-data-integrity.js`

**Validation Rules**:
1. Every ICD in `icd_cpt_links` must exist in `icd_codes`
2. Every CPT in `icd_cpt_links` must exist in `cpt_codes`
3. Every specifier root_code must exist in `icd_codes`
4. No duplicate embeddings
5. Embedding dimensions must be 1536
6. All active codes must have embeddings

**Actions**:
- Log all violations
- Auto-fix safe issues (remove orphans)
- Report critical issues requiring manual review

**Deliverables**:
- Validation report with pass/fail
- Auto-fix log
- Manual review list

---

#### **1.4 ICD-CPT Links Population** 📊 NEXT
**File**: `apps/api/scripts/populate-icd-cpt-links.js`

**Strategy**:
```javascript
// For each ICD code:
1. Get ICD embedding
2. Find top 10 most similar CPT codes (threshold: 0.3)
3. Insert into icd_cpt_links with:
   - icd_code
   - cpt_code
   - confidence_score: similarity score
   - relationship_type: "similarity_based"
   - clinical_context: "Auto-generated from embeddings"
   - created_at: now()
```

**Expected Output**:
- ~50,000-100,000 ICD→CPT relationships
- Baseline for agent validation
- Foundation for learning system

**Deliverables**:
- Populated `icd_cpt_links` table
- Statistics report
- Quality metrics

---

#### **1.5 Startup Health Check** 🏥 NEXT
**File**: `apps/api/src/health-checker.js`

**Checks on API Startup**:
```javascript
1. Database connection ✓
2. Embedding coverage >= 95% ✓
3. icd_cpt_links populated ✓
4. No orphan references ✓
5. pgvector extension enabled ✓
```

**Behavior**:
- ✅ All checks pass → API starts normally
- ⚠️ Some checks fail → API starts in degraded mode (warnings)
- ❌ Critical checks fail → API refuses to start

**Deliverables**:
- Health check middleware
- Status endpoint: `/api/system/health`
- Startup validation logs

---

### **Phase 1 Success Criteria**

✅ **Database Completeness**
- [x] 95%+ ICD codes have embeddings
- [x] 95%+ CPT codes have embeddings
- [x] `icd_cpt_links` has 50K+ relationships
- [x] Zero orphan references
- [x] All data integrity checks pass

✅ **Performance**
- [x] Full embedding regeneration takes <8 hours
- [x] Parallel processing with 10+ workers
- [x] Checkpoint/resume capability working

✅ **Quality**
- [x] Data quality score >= 95%
- [x] Health check passes on startup
- [x] Comprehensive diagnostic report

---

## 🤖 **PHASE 2: AGENTIC MULTI-VERIFIER SYSTEM**

### **Objective**
Replace 23 hardcoded rules with an intelligent multi-agent system that reasons, validates, and explains.

### **Architecture Overview**

```
User Request (ICD Code)
    ↓
┌─────────────────────────────────────────┐
│    Agent Orchestrator                   │
│    (apps/api/src/agents/orchestrator.js)│
└─────────────┬───────────────────────────┘
              │
    ┌─────────┴─────────┐
    │  Parallel Agents  │
    └─────────┬─────────┘
              │
    ┌─────────┴───────────────────────────┐
    │                                     │
    ↓                                     ↓
Agent 1: ICD Verifier              Agent 2: CPT Matcher
- Validates ICD code               - Finds relevant CPTs
- Checks existence                 - Uses embeddings
- Returns confidence               - Applies medical rules
    ↓                                     ↓
    │                                     │
    ↓                                     ↓
Agent 3: NICE Validator            Agent 4: Final Aggregator
- Checks NICE pathways             - Combines all results
- Validates compliance             - Calculates final score
- Returns guidelines               - Ranks suggestions
    ↓                                     ↓
    └─────────┬───────────────────────────┘
              │
              ↓
    Final Response with Reasoning
```

---

### **Agent Specifications**

#### **Agent 1: ICD Verifier Agent**
**File**: `apps/api/src/agents/icd-verifier.js`

**Responsibilities**:
- Validate ICD code exists in database
- Check if code is active/billable
- Verify specifiers are valid
- Return confidence score

**Input**:
```javascript
{ icdCode: "E11.9" }
```

**Output**:
```javascript
{
  valid: true,
  code: "E11.9",
  title: "Type 2 diabetes mellitus without complications",
  confidence: 0.98,
  metadata: { chapter, block, has_specifiers },
  warnings: []
}
```

**Confidence Calculation**:
```
- Code exists: +0.8
- Has embedding: +0.1
- Active status: +0.05
- Has metadata: +0.05
```

---

#### **Agent 2: CPT Matcher Agent**
**File**: `apps/api/src/agents/cpt-matcher.js`

**Responsibilities**:
- Find CPT procedures using embeddings
- Apply medical domain rules
- Check anatomical compatibility
- Generate matching reasoning

**Input**:
```javascript
{
  icdCode: "E11.9",
  icdEmbedding: [0.123, ...],
  icdMetadata: { chapter, title }
}
```

**Output**:
```javascript
{
  matches: [
    {
      code: "80047",
      description: "Metabolic panel",
      similarity: 0.82,
      reasoning: "Lab test appropriate for diabetes monitoring",
      medicalDomain: "pathology",
      anatomicalSite: null
    }
  ],
  totalCandidates: 15,
  filtered: 10,
  confidence: 0.85
}
```

**Logic**:
1. Vector search (similarity > 0.3)
2. Apply 23 existing rules (reuse from v1.0)
3. Anatomical validation
4. Domain matching
5. Score aggregation

---

#### **Agent 3: NICE Validator Agent**
**File**: `apps/api/src/agents/nice-validator.js`

**Responsibilities**:
- Validate against NICE clinical pathways
- Check procedure appropriateness
- Verify diagnostic order (imaging before surgery)
- Return compliance scores

**Input**:
```javascript
{
  icdCode: "E11.9",
  cptCode: "80047",
  icdMetadata: { chapter, title },
  cptMetadata: { chapter, description }
}
```

**Output**:
```javascript
{
  compliant: true,
  complianceScore: 0.92,
  pathways: ["NG28", "CG87"],
  guidelines: [
    "NICE NG28: Diabetes management requires regular HbA1c monitoring",
    "Metabolic panel appropriate for baseline assessment"
  ],
  flags: [],
  recommendations: ["Consider HbA1c test (83036) for diabetes monitoring"]
}
```

**NICE Rules Database**:
- Store as JSON or PostgreSQL table
- 50-100 common pathways
- Expandable via configuration

---

#### **Agent 4: Final Aggregator Agent**
**File**: `apps/api/src/agents/aggregator.js`

**Responsibilities**:
- Combine outputs from all agents
- Calculate weighted final scores
- Rank CPT suggestions
- Generate explainable reasoning

**Scoring Formula**:
```javascript
FinalScore = 
  (ICD.confidence × 0.25) +
  (CPT.similarity × 0.35) +
  (NICE.complianceScore × 0.30) +
  (MedicalRules.score × 0.10)

Threshold: >= 0.65 for approval
```

**Output**:
```javascript
{
  icd: {
    code: "E11.9",
    confidence: 0.98,
    verified: true
  },
  cptSuggestions: [
    {
      code: "80047",
      description: "Metabolic panel",
      finalScore: 0.87,
      breakdown: {
        icdConfidence: 0.98,
        similarity: 0.82,
        niceCompliance: 0.92,
        medicalRules: 0.85
      },
      reasoning: [
        "✓ ICD verified with 98% confidence",
        "✓ High semantic similarity (82%)",
        "✓ NICE compliant (NG28, CG87)",
        "✓ Appropriate for diabetes monitoring"
      ],
      nicePathways: ["NG28", "CG87"],
      approved: true
    }
  ],
  metadata: {
    totalAgents: 4,
    processingTime: 245,
    confidenceCalibrated: true
  }
}
```

---

### **Agent Communication Protocol**

**Message Format**:
```javascript
{
  agentId: "icd-verifier",
  timestamp: "2025-10-17T12:34:56Z",
  status: "success" | "error" | "warning",
  data: { /* agent-specific output */ },
  processingTime: 45,
  confidence: 0.95
}
```

**Error Handling**:
- Each agent has timeout (5 seconds)
- Failed agents return degraded results
- Orchestrator continues even if 1-2 agents fail
- Minimum 2 agents must succeed for valid response

---

### **API Design**

#### **New Endpoint**: `/api/icd/:code/agentic-cpt`

**Method**: GET  
**Query Params**:
- `limit` (default: 5) - Max CPT suggestions
- `minScore` (default: 0.65) - Minimum final score
- `includeReasoning` (default: true) - Include detailed reasoning
- `nicePathways` (optional) - Specific NICE pathways to check

**Response**:
```json
{
  "success": true,
  "icd": {
    "code": "E11.9",
    "title": "Type 2 diabetes mellitus without complications",
    "confidence": 0.98,
    "verified": true
  },
  "cptSuggestions": [
    {
      "code": "80047",
      "description": "Metabolic panel, basic",
      "finalScore": 0.87,
      "niceCompliant": true,
      "reasoning": [
        "✓ High confidence ICD verification (98%)",
        "✓ Strong semantic match (82%)",
        "✓ NICE NG28 compliant",
        "✓ Appropriate diagnostic test"
      ],
      "breakdown": {
        "icdConfidence": 0.98,
        "cptSimilarity": 0.82,
        "niceCompliance": 0.92,
        "medicalRules": 0.85
      }
    }
  ],
  "agentMetadata": {
    "icdVerifier": "success",
    "cptMatcher": "success",
    "niceValidator": "success",
    "aggregator": "success"
  },
  "processingTime": 245,
  "apiVersion": "2.0.0"
}
```

---

### **Phase 2 Success Criteria**

✅ **Agent Implementation**
- [x] 4 agents implemented and tested
- [x] Agent orchestrator working
- [x] Error handling and timeouts
- [x] Parallel execution

✅ **Quality**
- [x] Final scores calibrated (65% threshold)
- [x] Reasoning is clear and medical
- [x] NICE pathways validated
- [x] Better accuracy than v1.0 rules

✅ **Performance**
- [x] Agent orchestration < 500ms
- [x] Parallel agent execution
- [x] Graceful degradation on failures

---

## 📊 **PHASE 3: PRODUCTION OPTIMIZATION**

### **Tasks**

1. **Agent Performance Monitoring**
   - Track agent success rates
   - Log agent processing times
   - Monitor confidence calibration

2. **A/B Testing**
   - Compare v1.0 (rules) vs v2.0 (agents)
   - Measure accuracy improvements
   - Track user satisfaction

3. **Continuous Learning**
   - Store user feedback on suggestions
   - Retrain confidence thresholds
   - Update NICE pathways database

4. **API Optimization**
   - Caching layer for common ICDs
   - Pre-compute popular ICD→CPT links
   - Database query optimization

5. **Frontend Integration**
   - Update UI to show agent reasoning
   - Display NICE pathway references
   - Show confidence breakdown

---

## 📈 **Success Metrics**

### **Phase 1** (Database)
- Embedding coverage: 0.35% → 95%+
- Generation time: days → <8 hours
- Data integrity: 70% → 100%

### **Phase 2** (Agents)
- Response time: <500ms
- Accuracy: +15% vs v1.0
- Explainability: Full reasoning

### **Phase 3** (Production)
- User satisfaction: +25%
- API uptime: 99.9%
- Agent reliability: 95%+

---

## 🚀 **Next Steps**

### **Immediate Actions** (Today)

1. ✅ Create diagnostic script
2. ✅ Run full database assessment
3. ✅ Create parallel embedding generator
4. 🔄 Start Phase 1.2 - Generate missing embeddings

### **This Week**

- Complete Phase 1.1-1.3
- Start Phase 1.4 (ICD-CPT links)
- Begin Phase 2 agent design

### **Next 2 Weeks**

- Complete Phase 1 (database)
- Implement Phase 2 agents
- Test agent system

### **Weeks 3-6**

- Production deployment of v2.0
- Monitor and optimize
- Continuous improvement

---

## 💰 **Cost Estimation**

### **Phase 1: Embedding Generation**
```
ICD Codes: 67,965 × $0.00002 = $1.36
CPT Codes: 4,744 missing × $0.00002 = $0.09
Total Phase 1: ~$1.50
```

### **Phase 2: Agent Development**
- Development time: 40 hours
- Testing: 10 hours
- No additional API costs (reuses embeddings)

### **Phase 3: Production**
- Minimal additional costs
- Agent reasoning uses local logic, not LLM calls

---

**Status**: 🟢 Ready to Begin Phase 1  
**Next Review**: After Phase 1.2 completion  
**Target v2.0 Release**: Week 4

