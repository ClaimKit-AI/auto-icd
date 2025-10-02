-- CPT Codes Database Schema
-- This extends the ICD system with CPT (Current Procedural Terminology) codes

-- =============================================================================
-- CPT CODES TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS cpt_codes (
  code TEXT PRIMARY KEY,                    -- CPT code (e.g., "61618", "80061")
  display TEXT NOT NULL,                    -- Full procedure description
  short_description TEXT,                   -- Brief name (e.g., "Repair Dura")
  medium_description TEXT,                  -- Medium-length description
  normalized_display TEXT,                  -- Lowercase for search
  chapter TEXT,                             -- Category (e.g., "Surgery")
  subchapter TEXT,                          -- Sub-category
  code_range TEXT,                          -- Chapter code range
  active BOOLEAN DEFAULT TRUE,              -- Is code currently active
  activation_date DATE,                     -- When code was activated
  display_embedding VECTOR(1536),           -- AI embedding for semantic search
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- ICD-CPT MEDICAL LINKS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS icd_cpt_links (
  id SERIAL PRIMARY KEY,
  icd_code TEXT REFERENCES icd_codes(code) ON DELETE CASCADE,
  cpt_code TEXT REFERENCES cpt_codes(code) ON DELETE CASCADE,
  relationship_type TEXT,                   -- 'diagnostic', 'therapeutic', 'monitoring', 'surgical'
  confidence_score FLOAT,                   -- AI confidence 0-1
  clinical_context TEXT,                    -- AI-generated medical reasoning
  frequency TEXT,                           -- 'common', 'occasional', 'rare'
  created_by TEXT DEFAULT 'ai_agent',       -- Who created this link
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(icd_code, cpt_code)               -- Prevent duplicate links
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- CPT code search indexes
CREATE INDEX IF NOT EXISTS cpt_display_trgm ON cpt_codes USING gin(to_tsvector('english', display));
CREATE INDEX IF NOT EXISTS cpt_short_trgm ON cpt_codes USING gin(to_tsvector('english', short_description));
CREATE INDEX IF NOT EXISTS cpt_chapter_idx ON cpt_codes(chapter);
CREATE INDEX IF NOT EXISTS cpt_active_idx ON cpt_codes(active) WHERE active = true;

-- Vector search index for CPT codes
CREATE INDEX IF NOT EXISTS cpt_display_embedding_idx 
  ON cpt_codes USING ivfflat (display_embedding vector_cosine_ops) 
  WITH (lists = 50);

-- ICD-CPT linking indexes
CREATE INDEX IF NOT EXISTS icd_cpt_icd_idx ON icd_cpt_links(icd_code);
CREATE INDEX IF NOT EXISTS icd_cpt_cpt_idx ON icd_cpt_links(cpt_code);
CREATE INDEX IF NOT EXISTS icd_cpt_confidence_idx ON icd_cpt_links(confidence_score DESC);

-- =============================================================================
-- VECTOR SEARCH FUNCTION FOR CPT
-- =============================================================================

CREATE OR REPLACE FUNCTION match_cpt_codes (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  code text,
  display text,
  short_description text,
  chapter text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cpt_codes.code,
    cpt_codes.display,
    cpt_codes.short_description,
    cpt_codes.chapter,
    1 - (cpt_codes.display_embedding <=> query_embedding) as similarity
  FROM cpt_codes
  WHERE cpt_codes.display_embedding IS NOT NULL
    AND cpt_codes.active = true
    AND 1 - (cpt_codes.display_embedding <=> query_embedding) > match_threshold
  ORDER BY cpt_codes.display_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- =============================================================================
-- HELPER FUNCTION: GET CPT SUGGESTIONS FOR ICD
-- =============================================================================

CREATE OR REPLACE FUNCTION get_cpt_for_icd (
  p_icd_code text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  cpt_code text,
  cpt_display text,
  relationship_type text,
  confidence_score float,
  clinical_context text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.code,
    c.display,
    l.relationship_type,
    l.confidence_score,
    l.clinical_context
  FROM icd_cpt_links l
  JOIN cpt_codes c ON l.cpt_code = c.code
  WHERE l.icd_code = p_icd_code
    AND c.active = true
  ORDER BY l.confidence_score DESC, l.created_at DESC
  LIMIT p_limit;
END;
$$;

