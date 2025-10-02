# CPT Integration Plan - Auto-ICD v1

## 📊 **Data Analysis**

### CPT Data Structure:
- **Total Codes**: 9,942 CPT procedures
- **Columns Available**:
  - `CODE`: CPT code (e.g., "61618")
  - `DISPLAY`: Full procedure description
  - `short_description`: Brief name
  - `medium_description`: Medium-length description
  - `chapter_description`: Category (e.g., "Surgery")
  - `subchapter_description`: Sub-category
  - `chapter coderange`: Range (e.g., "61000-64999")
  - `active`: Boolean status
  - `code status`: Status code
  - `Activation Periods/start`: Activation date

## 🏗️ **Database Schema**

### New Table: `cpt_codes`
```sql
CREATE TABLE cpt_codes (
  code TEXT PRIMARY KEY,
  display TEXT NOT NULL,
  short_description TEXT,
  medium_description TEXT,
  normalized_display TEXT,
  chapter TEXT,
  subchapter TEXT,
  code_range TEXT,
  active BOOLEAN DEFAULT true,
  activation_date DATE,
  display_embedding VECTOR(1536)
);
```

### New Table: `icd_cpt_links`
```sql
CREATE TABLE icd_cpt_links (
  id SERIAL PRIMARY KEY,
  icd_code TEXT REFERENCES icd_codes(code),
  cpt_code TEXT REFERENCES cpt_codes(code),
  relationship_type TEXT,  -- 'primary', 'secondary', 'commonly_paired'
  confidence_score FLOAT,  -- AI confidence 0-1
  clinical_context TEXT,   -- AI-generated explanation
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## 🤖 **AI Medical Linking Strategy**

### Medically Correct Linking Rules:
1. **Diagnosis → Procedure Matching**:
   - ICD (diagnosis) → CPT (procedure/treatment)
   - Example: E11.21 (Diabetes with nephropathy) → 80061 (Lipid panel)

2. **AI Agentic Approach**:
   - Use OpenAI to analyze ICD diagnosis
   - Generate appropriate CPT recommendations
   - Consider: body system, condition severity, standard of care

3. **Embedding-Based Search**:
   - Vector similarity between ICD symptoms and CPT procedures
   - Hybrid search for accuracy

## ⚡ **Fast Loading Strategy** (Under 20 minutes)

### Batch Processing Approach:
1. **Load all 9,942 CPT codes**: ~30 seconds
2. **Generate embeddings in batches**:
   - Batch size: 50 codes
   - Parallel processing: 5 batches at once
   - Rate limiting: 100ms delay between batches
   - **Estimated time**: ~15 minutes for 9,942 codes

### Optimization:
- Use `text-embedding-3-small` (faster, cheaper)
- Process in background
- Save progress every 500 codes
- Resume capability if interrupted

## 🎨 **UI Integration**

### New Component: `CPTSuggestions`
- Shows when ICD code is selected
- Displays 3-5 relevant CPT procedures
- AI-generated explanation for each link
- One-click to add CPT to selection

### Layout:
```
[ICD Search Box]
  ↓
[Selected ICD: E11.21]
  ↓
[Suggested CPT Procedures]
  - 80061: Lipid panel (Monitoring diabetes)
  - 82947: Glucose test (Blood sugar monitoring)
  - 83036: Hemoglobin A1c (Diabetes management)
```

## 📝 **Implementation Steps**

1. ✅ Clean up old files (23 removed)
2. ✅ Analyze CPT data structure
3. ⏳ Update database schema
4. ⏳ Create fast CPT loader
5. ⏳ Generate CPT embeddings (batch)
6. ⏳ Build CPT search API
7. ⏳ Implement AI medical linking
8. ⏳ Create CPT UI component
9. ⏳ Test integration

## 🎯 **Success Criteria**

- ✅ All CPT codes loaded in database
- ✅ Embeddings generated for semantic search
- ✅ AI provides medically appropriate CPT suggestions for ICD codes
- ✅ Fast loading (< 20 minutes total)
- ✅ Clean, intuitive UI
- ✅ ICD system still works perfectly


