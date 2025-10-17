# 🏗️ System Architecture

## Overview

Auto-ICD uses **AI Embeddings + Rule-Based Validation**, **NOT an agent-based approach**. We use embeddings for similarity matching and rule-based logic for medical validation.

---

## 🧠 **Architecture Type: Embedding-Based RAG with Rule Validation**

### **NOT Using:**
- ❌ AI Agents
- ❌ LLM prompts for matching
- ❌ GPT-4 for decision making
- ❌ Chain-of-thought reasoning
- ❌ Agent frameworks (LangChain, CrewAI, etc.)

### **Actually Using:**
- ✅ **Vector Embeddings** (OpenAI text-embedding-3-small)
- ✅ **Similarity Search** (Cosine distance in PostgreSQL with pgvector)
- ✅ **Rule-Based Validation** (23 hardcoded medical rules)
- ✅ **NICE Care Pathways** (Clinical guidelines encoded as rules)

---

## 📊 **System Flow: Step-by-Step**

### **Stage 1: ICD Search** 🔍

**File**: `apps/api/src/database.js` → `getICDSuggestions()`

```javascript
User types "diabetes" 
    ↓
1. Convert to embedding (1536 dimensions)
    ↓
2. Compare with stored ICD embeddings in database
    ↓
3. Find top 8 closest matches using cosine similarity
    ↓
4. Return ICD codes to frontend
```

**AI Used**: Only for creating embeddings (no prompts, no agents)

---

### **Stage 2: ICD-CPT Matching** 🏥

**File**: `apps/api/src/database.js` → `getCPTForICD()`

**Process:**

```javascript
User confirms ICD code (e.g., E11.9 - Type 2 Diabetes)
    ↓
┌─────────────────────────────────────────┐
│ Step 1: Check Pre-computed Links        │
│ - Look in icd_cpt_links table           │
│ - If found, return immediately           │
└─────────────────────────────────────────┘
    ↓ (if not found)
┌─────────────────────────────────────────┐
│ Step 2: Get ICD Embedding                │
│ - Fetch ICD code details from database  │
│ - Get stored title_embedding vector      │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 3: Vector Similarity Search        │
│ - Compare ICD embedding with CPT embeds │
│ - Use cosine distance (pgvector <=>)    │
│ - Threshold: 0.35-0.40 (adaptive)       │
│ - Find 15 candidates (3x limit)         │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 4: Medical Validation (23 Rules)   │
│ - Block wrong anatomical sites          │
│ - Block cross-domain mismatches          │
│ - Boost appropriate procedures           │
│ - Score each CPT (0.0 - 0.95)           │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 5: Filter & Sort                    │
│ - Keep only score >= 0.65                │
│ - Sort by confidence score               │
│ - Return top 5 CPT codes                 │
└─────────────────────────────────────────┘
```

**Key Files:**
1. **`apps/api/src/database.js`** (lines 428-587)
   - `getCPTForICD()` - Main matching logic
   - `validateMedicalLinking()` - Validation rules (lines 811-1054)
   - `extractAnatomicalSites()` - Anatomy detection (lines 593-740)
   - `checkAnatomicalMatch()` - Site comparison (lines 746-802)

2. **`apps/api/src/rag-service.js`**
   - `generateEmbedding()` - Creates embeddings (lines 30-43)
   - `vectorSearch()` - Similarity search (lines 113-171)

---

## 🎯 **The 23 Medical Validation Rules**

**File**: `apps/api/src/database.js` → `validateMedicalLinking()`

### **Blocking Rules (10 rules)** ❌
Prevent medically inappropriate pairings:

1. **Rule 0**: Block cardiovascular procedures for non-cardiac conditions
2. **Rule 0b**: Block obstetric procedures for non-pregnancy
3. **Rule 0c**: Block neurological procedures for non-neuro conditions
4. **Rule 0d**: Block congenital repair for non-congenital conditions
5. **Rule 0e**: Block abdominal organ surgery for non-abdominal conditions
6. **Rule 0f**: Block cross-extremity errors (upper ≠ lower limbs)
7. **Rule 6**: Penalize surgery for mental health conditions
8. **Rule 1 (negative)**: Block wrong anatomical site for fractures
9. **Anatomical validation**: Prevent radius procedures for femur fractures
10. **Domain mismatch detection**: Block procedures from wrong medical domain

### **Boosting Rules (13 rules)** ✅
Increase score for clinically appropriate pairings:

1. **Rule 1**: Boost fracture procedures for correct anatomical site
2. **Rule 2**: Boost MSK procedures for musculoskeletal conditions
3. **Rule 3**: Boost diagnostic tests for infectious diseases
4. **Rule 4**: Boost injury procedures for injury codes (S-codes)
5. **Rule 5**: Boost monitoring for chronic conditions
6. **Rule 5b**: Strong boost for thyroid tests for thyroid disorders
7. **Rule 5c**: Boost lab/pathology for diagnostic workup
8. **Rule 5d**: General boost for lab tests
9. **Rule 7**: Boost E&M codes for sequela follow-up
10. **Rule 7b**: Boost rehabilitation for sequela
11. **Rule 7c**: Boost imaging for sequela healing assessment
12. **Rule 8**: NICE pathway - imaging first for fractures
13. **Anatomical match boost**: Extra points for matching body sites

---

## 🔢 **How Scoring Works**

Each CPT suggestion gets a confidence score (0.0 - 0.95):

```javascript
Initial Score (from AI similarity): 0.40 - 0.85
    ↓
Apply Blocking Rules (-0.7 to -0.9)
    ↓
Apply Boosting Rules (+0.1 to +0.45)
    ↓
Cap at 0.95 (medical humility - never 100% certain)
    ↓
Threshold Check: >= 0.65 → APPROVED
                  < 0.65 → REJECTED
    ↓
Return only APPROVED suggestions
```

### **Example Scoring:**

**Diabetes (E11.9) → CPT 84443 (Thyroid test)**
```
Initial similarity: 0.42
Rule 0 (cardiac block): 0.0 (not cardiac)
Rule 5c (lab boost): +0.30
Rule 5d (general lab): +0.10
───────────────────
Final score: 0.82 → ✅ APPROVED
```

**Radius Fracture (S52.501A) → CPT 23515 (Clavicle repair)**
```
Initial similarity: 0.65
Anatomy check: ICD=radius, CPT=clavicle → MISMATCH
Rule 1 (wrong site): -0.70
───────────────────
Final score: -0.05 → ❌ REJECTED
```

---

## 🗄️ **Database Schema**

### **Tables:**

1. **icd_codes**
   - `code` (TEXT): ICD-10-CM code
   - `title` (TEXT): Diagnosis description
   - `title_embedding` (VECTOR(1536)): AI embedding for similarity search
   - `has_specifiers` (BOOLEAN): Whether code has specifiers

2. **cpt_codes**
   - `code` (TEXT): CPT code
   - `display` (TEXT): Procedure description
   - `display_embedding` (VECTOR(1536)): AI embedding
   - `chapter` (TEXT): CPT chapter (Surgery, Radiology, etc.)
   - `active` (BOOLEAN): Whether code is currently active

3. **icd_cpt_links** (Optional pre-computed)
   - `icd_code` (TEXT): ICD code
   - `cpt_code` (TEXT): CPT code
   - `confidence_score` (FLOAT): Pre-computed confidence
   - `relationship_type` (TEXT): diagnostic/therapeutic/imaging

4. **icd_specifiers**
   - `root_code` (TEXT): Base ICD code
   - `dimension` (TEXT): laterality/encounter/severity
   - `code_suffix` (TEXT): Modifier character
   - `label` (TEXT): Human-readable label

---

## 🔍 **Vector Search Details**

### **How Embeddings Work:**

```javascript
// 1. Generate embedding for text
Input: "Type 2 diabetes mellitus"
    ↓
OpenAI text-embedding-3-small model
    ↓
Output: [0.123, -0.456, 0.789, ..., 0.234] (1536 numbers)

// 2. Store in database
PostgreSQL with pgvector extension

// 3. Search by similarity
SELECT code, title, 
       1 - (title_embedding <=> query_embedding) as similarity
FROM icd_codes
WHERE 1 - (title_embedding <=> query_embedding) > 0.4
ORDER BY title_embedding <=> query_embedding
LIMIT 8;
```

### **Similarity Thresholds:**

- **ICD Search**: 0.7 (high confidence needed)
- **CPT Search**: 0.4 (default)
- **CPT for Endocrine**: 0.35 (more lenient - specific terminology)
- **CPT for Infectious**: 0.38 (diagnostic tests)
- **Approval Threshold**: 0.65 (after validation rules)

---

## 🎨 **Frontend Architecture**

**File**: `apps/web/src/App.jsx`

```
User Input
    ↓
DiagnosisInput component
    ↓
useICDSuggestions hook → API /api/suggest
    ↓
SuggestionDropdown displays ICD codes
    ↓
User selects ICD code
    ↓
useICDSpecifiers hook → API /api/ranges/:code
    ↓
SpecifierTray displays modifiers
    ↓
User confirms final code
    ↓
useCPTSuggestions hook → API /api/icd/:code/cpt
    ↓
CPTSuggestions displays procedures with reasoning
```

**Key Components:**
- `MainSearch` - Search bar
- `SuggestionDropdown` - ICD results
- `SpecifierTray` - Code modifiers
- `CPTSuggestions` - Procedure recommendations
- `DiagnosisDetails` - Full diagnosis info

---

## 🚫 **What We're NOT Doing**

### **No AI Agents:**
```javascript
// ❌ NOT doing this:
const agent = new AIAgent({
  model: "gpt-4",
  prompt: "Match this ICD to CPT codes..."
})

// ✅ Actually doing this:
const similarity = cosineSimilarity(icdEmbedding, cptEmbedding)
if (similarity > 0.4) {
  const score = applyMedicalRules(icd, cpt)
  if (score >= 0.65) return cpt
}
```

### **No LLM Prompts:**
- No GPT-4 API calls for matching
- No prompt engineering
- No chain-of-thought reasoning
- Embeddings only (static vectors)

### **Why This Approach?**

✅ **Fast**: Vector search is instant (<100ms)  
✅ **Predictable**: Rules always behave the same  
✅ **Auditable**: Clear reasoning for each suggestion  
✅ **Cost-effective**: Embeddings generated once, reused forever  
✅ **Reliable**: No hallucinations, no prompt injection  

---

## 📁 **File Responsibility Summary**

| File | Responsibility | AI Used? |
|------|---------------|----------|
| `apps/api/src/database.js` | ICD/CPT matching, validation rules | Embeddings only |
| `apps/api/src/rag-service.js` | Generate & store embeddings | Yes - OpenAI |
| `apps/api/src/routes/suggest.js` | ICD search endpoint | No |
| `apps/api/src/routes/icd-cpt-link.js` | CPT suggestion endpoint | No |
| `apps/api/src/routes/cpt-suggest.js` | Direct CPT search | No |
| `apps/web/src/hooks/useICDSuggestions.js` | Frontend ICD search | No |
| `apps/web/src/hooks/useCPTSuggestions.js` | Frontend CPT fetch | No |

---

## 🔄 **Data Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                     USER INTERFACE                          │
│  (React App - apps/web/src/App.jsx)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             │ User types "diabetes"
             ↓
┌─────────────────────────────────────────────────────────────┐
│              FRONTEND HOOKS                                 │
│  useICDSuggestions() → GET /api/suggest?q=diabetes         │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP Request
             ↓
┌─────────────────────────────────────────────────────────────┐
│              API ROUTES                                     │
│  apps/api/src/routes/suggest.js                            │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Call database function
             ↓
┌─────────────────────────────────────────────────────────────┐
│              RAG SERVICE                                    │
│  apps/api/src/rag-service.js                               │
│  - generateEmbedding("diabetes") → OpenAI API              │
│  - returns [0.123, -0.456, ..., 0.789]                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Embedding vector
             ↓
┌─────────────────────────────────────────────────────────────┐
│              DATABASE                                       │
│  PostgreSQL + pgvector                                      │
│  - Compare with stored ICD embeddings                       │
│  - Return top 8 matches                                     │
└────────────┬────────────────────────────────────────────────┘
             │
             │ ICD codes
             ↓
┌─────────────────────────────────────────────────────────────┐
│              USER SELECTS CODE                              │
│  E11.9 - Type 2 Diabetes                                   │
└────────────┬────────────────────────────────────────────────┘
             │
             │ Confirm diagnosis
             ↓
┌─────────────────────────────────────────────────────────────┐
│              CPT SUGGESTION REQUEST                         │
│  useCPTSuggestions() → GET /api/icd/E11.9/cpt              │
└────────────┬────────────────────────────────────────────────┘
             │
             │ HTTP Request
             ↓
┌─────────────────────────────────────────────────────────────┐
│              ICD-CPT MATCHING                               │
│  apps/api/src/database.js → getCPTForICD()                 │
│  1. Get ICD embedding from database                         │
│  2. Vector search CPT codes (similarity > 0.35)            │
│  3. Apply 23 validation rules                               │
│  4. Score and filter (>= 0.65)                             │
│  5. Return top 5 CPT codes                                  │
└────────────┬────────────────────────────────────────────────┘
             │
             │ CPT suggestions with confidence scores
             ↓
┌─────────────────────────────────────────────────────────────┐
│              DISPLAY RESULTS                                │
│  CPTSuggestions component shows:                           │
│  - 84443: TSH test (confidence: 82%)                       │
│  - 80047: Metabolic panel (confidence: 78%)                │
│  - etc.                                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 **Key Takeaways**

1. **No AI Agents** - We use embeddings (static vectors) not LLMs
2. **23 Hardcoded Rules** - Medical validation is rule-based, not AI-based
3. **Fast & Predictable** - Vector search + rules = consistent results
4. **Single AI Usage** - Only OpenAI embeddings API (text-embedding-3-small)
5. **No Prompts** - No GPT-4, no chain-of-thought, no agent frameworks

---

## 📞 **Questions?**

- **"Is this an AI agent?"** → No, it's embedding-based RAG
- **"Where are the prompts?"** → There are none, just embeddings
- **"How many agents?"** → Zero agents, just vector similarity + rules
- **"Can I change the matching logic?"** → Yes, edit the 23 rules in `database.js`

---

**Last Updated**: 2025-10-17  
**Version**: 1.0.0

