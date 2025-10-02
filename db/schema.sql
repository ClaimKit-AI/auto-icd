-- ICD Suggest & Specifier Tray Database Schema
-- This file sets up the PostgreSQL database with all required extensions and tables
-- Run this script in your Supabase project to create the database structure

-- =============================================================================
-- REQUIRED EXTENSIONS
-- =============================================================================
-- These extensions enable advanced text search and AI vector operations

-- Enable fuzzy text search using trigram similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enable text normalization (removes accents, handles international text)
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Enable AI vector operations for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Main ICD codes table - stores all diagnosis codes and their information
CREATE TABLE IF NOT EXISTS icd_codes (
  code TEXT PRIMARY KEY,                    -- ICD code (e.g., "I10", "E11.9")
  title TEXT NOT NULL,                      -- Full diagnosis name
  normalized_title TEXT,                    -- Lowercase, unaccented version for search
  synonyms JSONB DEFAULT '[]',              -- Alternative names ["HTN", "High blood pressure"]
  chapter TEXT,                             -- ICD chapter (e.g., "Diseases of the circulatory system")
  block TEXT,                               -- ICD block classification
  category TEXT,                            -- ICD category
  parents TEXT[] DEFAULT '{}',              -- Parent codes in hierarchy
  has_specifiers BOOLEAN DEFAULT FALSE,     -- Whether this code has modifiers
  title_embedding VECTOR(1536)              -- AI embedding for semantic search
);

-- Specifiers table - stores ICD code modifiers (laterality, encounter, severity)
CREATE TABLE IF NOT EXISTS icd_specifiers (
  root_code TEXT,                           -- Base code (e.g., "S52.5")
  dimension TEXT,                           -- Type of modifier ("laterality", "encounter", "severity")
  code_suffix TEXT,                         -- Suffix character ("1", "2", "A", "D", "S")
  label TEXT,                               -- Human-readable description
  PRIMARY KEY (root_code, dimension, code_suffix)
);

-- Detailed diagnosis information table - comprehensive metadata for each ICD code
CREATE TABLE IF NOT EXISTS icd_diagnosis_details (
  code TEXT PRIMARY KEY,                    -- ICD code (e.g., "I10", "E11.9")
  description TEXT,                         -- Detailed clinical description
  clinical_notes TEXT,                      -- Clinical notes and observations
  symptoms TEXT[],                          -- Common symptoms array
  risk_factors TEXT[],                      -- Risk factors array
  complications TEXT[],                     -- Potential complications
  treatment_notes TEXT,                     -- General treatment information
  icd_chapter TEXT,                         -- ICD chapter name
  icd_block TEXT,                           -- ICD block name
  icd_category TEXT,                        -- ICD category name
  body_system TEXT,                         -- Affected body system
  severity_levels TEXT[],                   -- Available severity levels
  age_groups TEXT[],                        -- Common age groups affected
  gender_preference TEXT,                   -- Gender preference if any
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Optional analytics table - tracks user interactions (no PHI)
CREATE TABLE IF NOT EXISTS ui_events (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ DEFAULT now(),             -- When the event happened
  event_type TEXT,                          -- Type: "keypress", "suggest", "select"
  query_hash TEXT,                          -- Hashed version of search query (privacy)
  latency_ms INT,                           -- How long the request took
  payload JSONB                             -- Additional event data
);

-- =============================================================================
-- PERFORMANCE INDEXES
-- =============================================================================
-- These indexes make searches fast and efficient

-- Text search indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS icd_title_trgm ON icd_codes USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS icd_norm_trgm ON icd_codes USING gin (normalized_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS icd_syn_gin ON icd_codes USING gin ((synonyms));

-- AI vector search index for semantic similarity
-- Note: IVFFlat requires ANALYZE and sufficient data to be efficient
CREATE INDEX IF NOT EXISTS icd_vec_idx ON icd_codes USING ivfflat (title_embedding vector_cosine_ops) WITH (lists = 100);

-- Regular indexes for common queries
CREATE INDEX IF NOT EXISTS icd_code_idx ON icd_codes (code);
CREATE INDEX IF NOT EXISTS icd_spec_root_idx ON icd_specifiers (root_code);
CREATE INDEX IF NOT EXISTS icd_details_code_idx ON icd_diagnosis_details (code);
CREATE INDEX IF NOT EXISTS ui_events_ts_idx ON ui_events (ts);

-- =============================================================================
-- SAMPLE DATA INSERTS
-- =============================================================================
-- Insert some common ICD codes for testing

INSERT INTO icd_codes (code, title, normalized_title, synonyms, chapter, has_specifiers) VALUES
('I10', 'Essential (primary) hypertension', 'essential primary hypertension', '["HTN", "High blood pressure", "Hypertension"]', 'Diseases of the circulatory system', false),
('E11.9', 'Type 2 diabetes mellitus without complications', 'type 2 diabetes mellitus without complications', '["DM type 2", "Diabetes type 2", "T2DM"]', 'Endocrine, nutritional and metabolic diseases', false),
('S52.5', 'Fracture of radius', 'fracture of radius', '["Radius fracture", "Forearm fracture"]', 'Injury, poisoning and certain other consequences of external causes', true),
('J45.9', 'Asthma, unspecified', 'asthma unspecified', '["Asthma", "Bronchial asthma"]', 'Diseases of the respiratory system', false)
ON CONFLICT (code) DO NOTHING;

-- Insert specifiers for the radius fracture example
INSERT INTO icd_specifiers (root_code, dimension, code_suffix, label) VALUES
('S52.5', 'laterality', '1', 'Right'),
('S52.5', 'laterality', '2', 'Left'),
('S52.5', 'encounter', 'A', 'Initial encounter'),
('S52.5', 'encounter', 'D', 'Subsequent encounter'),
('S52.5', 'encounter', 'S', 'Sequela')
ON CONFLICT (root_code, dimension, code_suffix) DO NOTHING;

-- Insert detailed diagnosis information
INSERT INTO icd_diagnosis_details (code, description, clinical_notes, symptoms, risk_factors, complications, treatment_notes, icd_chapter, icd_block, icd_category, body_system, severity_levels, age_groups, gender_preference) VALUES
('I10', 'Essential (primary) hypertension is a chronic medical condition characterized by persistently elevated blood pressure without an identifiable secondary cause.', 'Blood pressure consistently ≥140/90 mmHg on multiple readings. Requires lifestyle modifications and often antihypertensive medications.', '["Often asymptomatic", "Headaches", "Dizziness", "Chest pain", "Shortness of breath", "Visual changes"]', '["Family history", "Age >65", "Obesity", "Sedentary lifestyle", "High sodium diet", "Excessive alcohol", "Smoking", "Stress"]', '["Heart disease", "Stroke", "Kidney disease", "Eye damage", "Metabolic syndrome"]', 'Lifestyle modifications (diet, exercise, weight loss) and antihypertensive medications. Regular monitoring required.', 'Diseases of the circulatory system', 'Hypertensive diseases', 'Essential hypertension', 'Cardiovascular system', '["Mild", "Moderate", "Severe"]', '["Adults", "Elderly"]', 'None'),
('E11.9', 'Type 2 diabetes mellitus without complications is a chronic metabolic disorder characterized by insulin resistance and relative insulin deficiency.', 'Fasting glucose ≥126 mg/dL or HbA1c ≥6.5%. Managed with lifestyle modifications, oral medications, and/or insulin.', '["Increased thirst", "Frequent urination", "Fatigue", "Blurred vision", "Slow healing", "Recurrent infections"]', '["Obesity", "Family history", "Age >45", "Sedentary lifestyle", "High blood pressure", "Abnormal cholesterol", "Gestational diabetes history"]', '["Diabetic ketoacidosis", "Hyperosmolar hyperglycemic state", "Cardiovascular disease", "Neuropathy", "Nephropathy", "Retinopathy"]', 'Blood glucose monitoring, dietary management, regular exercise, oral antidiabetic agents, and insulin therapy as needed.', 'Endocrine, nutritional and metabolic diseases', 'Diabetes mellitus', 'Type 2 diabetes mellitus', 'Endocrine system', '["Mild", "Moderate", "Severe"]', '["Adults", "Elderly"]', 'None'),
('S52.5', 'Fracture of radius is a break in the radius bone of the forearm, commonly occurring at the distal end near the wrist.', 'Most common fracture in adults. Often results from fall on outstretched hand. Requires immobilization and may need surgical intervention.', '["Severe pain", "Swelling", "Bruising", "Deformity", "Limited range of motion", "Tenderness"]', '["Osteoporosis", "Age >50", "Female gender", "Previous fractures", "Falls", "High-impact trauma"]', '["Nonunion", "Malunion", "Stiffness", "Nerve damage", "Compartment syndrome", "Complex regional pain syndrome"]', 'Immobilization with cast or splint, pain management, physical therapy. Surgical fixation may be required for displaced fractures.', 'Injury, poisoning and certain other consequences of external causes', 'Fractures of forearm', 'Fracture of radius', 'Musculoskeletal system', '["Mild", "Moderate", "Severe"]', '["Adults", "Elderly"]', 'Female')
ON CONFLICT (code) DO NOTHING;

-- =============================================================================
-- HELPFUL COMMENTS
-- =============================================================================
-- 
-- To use this schema:
-- 1. Run this script in your Supabase SQL editor
-- 2. The extensions will be enabled automatically
-- 3. Tables and indexes will be created
-- 4. Sample data will be inserted for testing
--
-- For production:
-- 1. Replace sample data with full ICD dataset
-- 2. Run ANALYZE on tables after loading data
-- 3. Consider using HNSW index instead of IVFFlat for better performance
--

