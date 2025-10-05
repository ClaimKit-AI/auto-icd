// ICD Suggest & Specifier Tray - Database Connection
// This module handles all database operations using PostgreSQL
// Enhanced with RAG (Retrieval-Augmented Generation) capabilities for AI-powered search

import pkg from 'pg';
const { Pool } = pkg;
import { hybridSearch, aiPoweredSuggestions } from './rag-service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// =============================================================================
// DATABASE CONNECTION SETUP
// =============================================================================

// Create database connection pool
// A pool manages multiple connections for better performance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings for better performance
  max: 20,                    // Maximum number of connections
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  connectionTimeoutMillis: 2000, // Timeout after 2 seconds
});

// =============================================================================
// DATABASE QUERY FUNCTIONS
// =============================================================================

/**
 * Execute a SQL query with parameters
 * @param {string} text - SQL query string
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(text, params = []) {
  const start = Date.now();
  
  try {
    // Execute the query using the connection pool
    const result = await pool.query(text, params);
    
    // Log query performance for debugging
    const duration = Date.now() - start;
    if (duration > 100) { // Log slow queries (>100ms)
      console.log(`🐌 Slow query (${duration}ms): ${text.substring(0, 100)}...`);
    }
    
    return result;
  } catch (error) {
    // Log database errors
    console.error('❌ Database query error:', error.message);
    throw error;
  }
}

/**
 * Get ICD code suggestions based on search query
 * This implements Stage A of our hybrid search algorithm
 * @param {string} searchQuery - User's search text
 * @param {number} limit - Maximum number of results
 * @returns {Promise<Array>} Array of ICD code suggestions
 */
export async function getICDSuggestions(searchQuery, limit = 8) {
  // Normalize the search query (remove accents, lowercase)
  const normalizedQuery = searchQuery.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return [];
  }
  
  try {
    // Use AI-powered hybrid search for better results
    console.log(`🔍 AI-powered search for: "${searchQuery}"`);
    
    const aiResults = await aiPoweredSuggestions(searchQuery, { limit });
    
    if (aiResults && aiResults.length > 0) {
      console.log(`✅ Found ${aiResults.length} AI-powered results`);
      return aiResults.slice(0, limit);
    }
    
    // Fallback to traditional search if AI search fails
    console.log('⚠️ AI search failed, falling back to traditional search');
    
    const sql = `
      WITH q AS (SELECT unaccent($1)::text AS qtxt)
      SELECT 
        code, 
        title,
        synonyms,
        chapter,
        has_specifiers,
        -- Calculate relevance score based on multiple factors
        0.7 * (title ILIKE qtxt || '%')::int +                    -- Exact prefix match (highest weight)
        0.5 * (normalized_title ILIKE qtxt || '%')::int +         -- Normalized prefix match
        0.5 * GREATEST(similarity(title, qtxt), similarity(normalized_title, qtxt)) + -- Fuzzy similarity
        0.8 * (code ILIKE qtxt || '%')::int +                     -- Code prefix match (high weight)
        0.4 * (EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(synonyms) s 
          WHERE unaccent(s) ILIKE qtxt || '%'
        ))::int AS score
      FROM icd_codes, q
      WHERE
        title ILIKE qtxt || '%'
        OR normalized_title ILIKE qtxt || '%'
        OR code ILIKE qtxt || '%'
        OR (title % qtxt)  -- Trigram similarity
      ORDER BY score DESC, title ASC
      LIMIT $2;
    `;
    
    const result = await query(sql, [normalizedQuery, limit]);
    return result.rows;
    
  } catch (error) {
    console.error('❌ Error getting ICD suggestions:', error);
    return [];
  }
}

/**
 * Get ICD specifiers for a given code
 * @param {string} code - ICD code (full or partial)
 * @returns {Promise<Object>} Specifiers organized by dimension
 */
export async function getICDSpecifiers(code) {
  if (!code) {
    return { root: null, specifiers: {} };
  }
  
  // Extract root code for ICD-10-CM specifiers
  // This handles the hierarchical nature of ICD-10-CM codes
  let rootCode = code;
  
  // Remove any existing specifiers to get the base code
  // ICD-10-CM specifiers are added after the decimal point
  
  // For codes with encounter specifiers (7th character: A, D, S)
  if (/[ADS]$/.test(code)) {
    rootCode = code.slice(0, -1); // Remove last character
  }
  
  // For codes with laterality (4th character: 1, 2, 3)
  if (/[123]$/.test(rootCode) && rootCode.length > 4) {
    rootCode = rootCode.slice(0, -1); // Remove last character
  }
  
  // For codes with severity (5th/6th character: 0-9)
  if (/[0-9]$/.test(rootCode) && rootCode.length > 4) {
    // Check if this is a severity specifier or part of the base code
    const basePart = rootCode.split('.')[0];
    if (rootCode.length > basePart.length + 2) {
      rootCode = rootCode.slice(0, -1);
    }
  }
  
  // Ensure we have the proper base code format
  // If the code doesn't have a decimal, we need to add one for specifiers
  if (!rootCode.includes('.') && rootCode.length >= 3) {
    // For codes like I10, I11, etc., we keep them as is for base lookup
    // But for specifier matching, we might need the decimal format
  }
  
  const sql = `
    SELECT dimension, code_suffix, label
    FROM icd_specifiers
    WHERE root_code = $1
    ORDER BY dimension, code_suffix;
  `;
  
  try {
    const result = await query(sql, [rootCode]);
    
    // Organize specifiers by dimension
    const specifiers = {};
    result.rows.forEach(row => {
      if (!specifiers[row.dimension]) {
        specifiers[row.dimension] = [];
      }
      specifiers[row.dimension].push({
        suffix: row.code_suffix,
        label: row.label
      });
    });
    
    return {
      root: rootCode,
      specifiers: specifiers
    };
  } catch (error) {
    console.error('❌ Error getting ICD specifiers:', error);
    return { root: rootCode, specifiers: {} };
  }
}

/**
 * Get detailed diagnosis information for a given ICD code
 * @param {string} code - ICD code
 * @returns {Promise<Object|null>} Detailed diagnosis information
 */
export async function getDiagnosisDetails(code) {
  if (!code) {
    return null;
  }
  
  const sql = `
    SELECT 
      code,
      description,
      clinical_notes,
      symptoms,
      risk_factors,
      complications,
      treatment_notes,
      icd_chapter,
      icd_block,
      icd_category,
      body_system,
      severity_levels,
      age_groups,
      gender_preference,
      created_at,
      updated_at
    FROM icd_diagnosis_details
    WHERE code = $1;
  `;
  
  try {
    const result = await query(sql, [code]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('❌ Error getting diagnosis details:', error);
    return null;
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection is working
 */
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Close database connection pool
 * Call this when shutting down the application
 */
export async function closePool() {
  try {
    await pool.end();
    console.log('🔌 Database connection pool closed');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
  }
}

// =============================================================================
// EXPORT ALL FUNCTIONS
// =============================================================================

// =============================================================================
// CPT CODE SEARCH
// =============================================================================

/**
 * Get CPT code suggestions using AI-powered hybrid search
 * @param {string} searchQuery - User's search query
 * @param {number} limit - Maximum number of results
 * @returns {Array} Array of CPT code suggestions
 */
export async function getCPTSuggestions(searchQuery, limit = 8) {
  const normalizedQuery = searchQuery.toLowerCase().trim();
  
  if (!normalizedQuery) {
    return [];
  }
  
  try {
    // Use AI-powered search for CPT codes
    console.log(`🔍 AI-powered CPT search for: "${searchQuery}"`);
    
    const aiResults = await aiPoweredSuggestions(searchQuery, { limit, table: 'cpt' });
    
    if (aiResults && aiResults.length > 0) {
      console.log(`✅ Found ${aiResults.length} AI-powered CPT results`);
      return aiResults.slice(0, limit);
    }
    
    // Fallback to traditional search
    console.log('⚠️ AI CPT search failed, falling back to traditional search');
    
    const result = await pool.query(`
      SELECT 
        code,
        display,
        short_description,
        chapter,
        subchapter
      FROM cpt_codes
      WHERE active = true
        AND (
          display ILIKE $1
          OR short_description ILIKE $1
          OR normalized_display ILIKE $1
        )
      ORDER BY 
        CASE 
          WHEN short_description ILIKE $2 THEN 1
          WHEN display ILIKE $2 THEN 2
          ELSE 3
        END,
        short_description
      LIMIT $3
    `, [`%${normalizedQuery}%`, `${normalizedQuery}%`, limit]);
    
    return result.rows || [];
    
  } catch (error) {
    console.error('❌ Error in getCPTSuggestions:', error);
    return [];
  }
}

/**
 * Expand medical terminology to include related procedure terms
 * Maps diagnosis terms to CPT procedure terminology
 */
function expandMedicalTerms(keywords, icdCode, chapter) {
  const expanded = new Set(keywords);
  
  // Medical condition → Procedure terminology mapping
  const medicalMapping = {
    // Endocrine conditions
    'hypothyroidism': ['thyroid', 'tsh', 'thyroxine', 't3', 't4', 'thyroid function'],
    'hyperthyroidism': ['thyroid', 'tsh', 'thyroxine', 't3', 't4', 'thyroid function'],
    'diabetes': ['glucose', 'blood sugar', 'hemoglobin a1c', 'insulin', 'diabetic'],
    'thyroid': ['tsh', 'thyroxine', 't3', 't4', 'thyroid function', 'thyroid scan'],
    
    // Cardiovascular
    'hypertension': ['blood pressure', 'cardiac', 'echocardiogram', 'ekg'],
    'heart': ['cardiac', 'echocardiogram', 'ekg', 'stress test', 'coronary'],
    'myocardial': ['cardiac', 'heart', 'coronary', 'troponin'],
    
    // Respiratory
    'asthma': ['pulmonary', 'lung function', 'spirometry', 'respiratory'],
    'pneumonia': ['chest', 'lung', 'respiratory', 'culture', 'xray'],
    
    // Infectious
    'infection': ['culture', 'test', 'antibody', 'antigen', 'pathogen'],
    'sepsis': ['blood culture', 'culture', 'infectious disease'],
    
    // Renal
    'kidney': ['renal', 'creatinine', 'bun', 'urinalysis'],
    'nephropathy': ['kidney', 'renal', 'creatinine', 'urinalysis'],
    
    // Hepatic
    'liver': ['hepatic', 'alt', 'ast', 'bilirubin'],
    'hepatitis': ['liver', 'hepatic', 'alt', 'ast', 'viral hepatitis'],
    
    // Hematology
    'anemia': ['blood', 'hemoglobin', 'iron', 'ferritin', 'cbc'],
    'bleeding': ['coagulation', 'pt', 'inr', 'ptt', 'clotting'],
    
    // Lab general
    'blood': ['laboratory', 'test', 'panel', 'screening'],
    'urine': ['urinalysis', 'urine test', 'culture']
  };
  
  // Apply mappings
  keywords.forEach(keyword => {
    if (medicalMapping[keyword]) {
      medicalMapping[keyword].forEach(term => expanded.add(term));
    }
  });
  
  // Chapter-based expansions
  if (chapter?.includes('Endocrine')) {
    expanded.add('hormone');
    expanded.add('metabolic');
    expanded.add('laboratory');
  }
  
  if (chapter?.includes('Infectious')) {
    expanded.add('culture');
    expanded.add('test');
    expanded.add('pathogen');
  }
  
  // ICD code-based expansions
  if (icdCode?.match(/^E0[0-7]/)) { // Thyroid disorders
    expanded.add('thyroid');
    expanded.add('tsh');
  }
  
  if (icdCode?.match(/^E1[01]/)) { // Diabetes
    expanded.add('glucose');
    expanded.add('diabetic');
  }
  
  if (icdCode?.match(/^I[0-5]\d/)) { // Cardiovascular
    expanded.add('cardiac');
    expanded.add('heart');
  }
  
  // Remove stopwords
  const stopwords = ['unspecified', 'other', 'certain', 'with', 'without'];
  const filtered = Array.from(expanded).filter(word => !stopwords.includes(word));
  
  return filtered.slice(0, 8); // Return top 8 keywords
}

/**
 * Get medically appropriate CPT codes for a given ICD code using AI
 * @param {string} icdCode - ICD diagnosis code
 * @param {number} limit - Maximum number of CPT suggestions
 * @returns {Array} Array of relevant CPT codes with AI reasoning
 */
export async function getCPTForICD(icdCode, limit = 5) {
  try {
    console.log(`🏥 Finding CPT codes for ICD: ${icdCode}`);
    
    // First check if we have pre-computed links
    const linksResult = await pool.query(`
      SELECT 
        c.code,
        c.display,
        c.short_description,
        c.chapter,
        l.relationship_type,
        l.confidence_score,
        l.clinical_context
      FROM icd_cpt_links l
      JOIN cpt_codes c ON l.cpt_code = c.code
      WHERE l.icd_code = $1
        AND c.active = true
      ORDER BY l.confidence_score DESC
      LIMIT $2
    `, [icdCode, limit]);
    
    if (linksResult.rows.length > 0) {
      console.log(`✅ Found ${linksResult.rows.length} pre-computed CPT links`);
      return linksResult.rows;
    }
    
    // Get the ICD details with embedding
    const icdResult = await pool.query(`
      SELECT code, title, chapter, block, title_embedding
      FROM icd_codes
      WHERE code = $1
    `, [icdCode]);
    
    if (icdResult.rows.length === 0) {
      return [];
    }
    
    const icd = icdResult.rows[0];
    
    // Try AI-powered vector search if we have embeddings
    if (icd.title_embedding) {
      console.log('🤖 Using AI vector search for CPT suggestions...');
      
      // Adaptive threshold based on ICD type
      // Lab/pathology procedures tend to have lower similarity scores
      let similarityThreshold = 0.4; // Default
      
      // Lower threshold for endocrine/lab conditions (more specific terminology)
      if (icd.code?.match(/^E/) || icd.chapter?.includes('Endocrine') || icd.chapter?.includes('Metabolic')) {
        similarityThreshold = 0.35; // More lenient for endocrine
        console.log('   📊 Using lower threshold (0.35) for endocrine/metabolic condition');
      }
      
      // Lower threshold for infectious diseases (diagnostic tests)
      if (icd.code?.match(/^[AB]/) || icd.chapter?.includes('Infectious')) {
        similarityThreshold = 0.38;
        console.log('   📊 Using threshold (0.38) for infectious disease');
      }
      
      // Use ICD embedding to find similar CPT procedures
      // Parse embedding if it's a JSON string
      let embeddingVector = icd.title_embedding;
      if (typeof embeddingVector === 'string') {
        try {
          embeddingVector = JSON.parse(embeddingVector);
        } catch (e) {
          console.log('   ⚠️ Embedding already parsed');
        }
      }
      
      const vectorResult = await pool.query(`
        SELECT 
          code,
          display,
          short_description,
          chapter,
          subchapter,
          1 - (display_embedding <=> $1::vector) as similarity
        FROM cpt_codes
        WHERE display_embedding IS NOT NULL
          AND active = true
          AND 1 - (display_embedding <=> $1::vector) > $2
        ORDER BY display_embedding <=> $1::vector
        LIMIT $3
      `, [JSON.stringify(embeddingVector), similarityThreshold, limit * 3]); // Get more for validation
      
      if (vectorResult.rows.length > 0) {
        console.log(`✅ Found ${vectorResult.rows.length} AI-powered CPT matches`);
        
        // Validate medical appropriateness
        const validated = await validateMedicalLinking(icd, vectorResult.rows);
        return validated.slice(0, limit);
      }
    }
    
    // Fallback to traditional text search WITH VALIDATION
    console.log('🔍 Using traditional search for CPT codes (no ICD embedding)...');
    
    // Extract keywords from ICD title and expand with medical synonyms
    const rawKeywords = icd.title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    // Medical terminology mapper - expand condition names to related procedures
    const keywords = expandMedicalTerms(rawKeywords, icd.code, icd.chapter);
    
    console.log(`   Keywords: ${keywords.join(', ')}`);
    
    // Search CPT codes using each keyword
    const allResults = new Map();
    
    for (const keyword of keywords) {
      const result = await pool.query(`
        SELECT 
          code,
          display,
          short_description,
          chapter,
          subchapter
        FROM cpt_codes
        WHERE active = true
          AND (
            display ILIKE $1
            OR short_description ILIKE $1
            OR normalized_display ILIKE $1
          )
        LIMIT 10
      `, [`%${keyword}%`]);
      
      result.rows.forEach(cpt => {
        if (!allResults.has(cpt.code)) {
          allResults.set(cpt.code, {
            ...cpt,
            similarity: 0.6, // Base similarity for traditional search
            relationship_type: 'keyword_match',
            confidence_score: 0.6,
            clinical_context: `Related to: ${keyword}`
          });
        }
      });
    }
    
    const traditionalResults = Array.from(allResults.values());
    console.log(`   Found ${traditionalResults.length} traditional CPT matches`);
    
    // CRITICAL: Apply medical validation to traditional search results too!
    console.log('   🛡️ Applying medical validation to traditional results...');
    const validated = await validateMedicalLinking(icd, traditionalResults);
    
    console.log(`   ✅ ${validated.length} procedures passed validation`);
    return validated.slice(0, limit);
    
  } catch (error) {
    console.error('❌ Error in getCPTForICD:', error);
    return [];
  }
}

/**
 * Extract anatomical sites from text and code
 * Returns array of body regions/sites mentioned
 */
function extractAnatomicalSites(text, code) {
  const sites = [];
  const lowerText = (text || '').toLowerCase();
  const lowerCode = (code || '').toLowerCase();
  
  // Comprehensive anatomical mapping - SPECIFIC bone matching for fractures
  const anatomyMap = {
    // Head and Neck
    'skull': ['skull', 'cranium', 'head bone'],
    'mandible': ['mandible', 'jaw', 'lower jaw', 'alveolus', 'alveolar'],
    'maxilla': ['maxilla', 'upper jaw'],
    'face': ['face', 'facial'],
    'neck': ['neck', 'cervical'],
    
    // Upper Extremity - SPECIFIC bones (don't group!)
    'clavicle': ['clavicle', 'clavicular', 'collarbone'],
    'scapula': ['scapula', 'scapular', 'shoulder blade'],
    'humerus': ['humerus', 'humeral', 'upper arm'],
    'elbow': ['elbow', 'olecranon'],
    'radius': ['radius', 'radial'],
    'ulna': ['ulna', 'ulnar'],
    'forearm': ['forearm'],
    'wrist': ['wrist', 'carpal'],
    'hand': ['hand', 'metacarp', 'phalang', 'finger', 'thumb'],
    
    // Lower Extremity  
    'hip': ['hip', 'femoral head', 'acetabulum'],
    'femur': ['femur', 'thigh', 'femoral shaft'],
    'knee': ['knee', 'patella', 'tibial plateau'],
    'tibia': ['tibia', 'tibial'],
    'fibula': ['fibula', 'fibular'],
    'ankle': ['ankle', 'malleolus'],
    'foot': ['foot', 'tarsal', 'metatarsal', 'toe'],
    
    // Spine
    'spine': ['spine', 'vertebr', 'spinal'],
    'cervical': ['cervical spine', 'c-spine', 'neck'],
    'thoracic': ['thoracic spine', 't-spine'],
    'lumbar': ['lumbar spine', 'l-spine', 'lower back'],
    
    // Trunk
    'chest': ['chest', 'thorax', 'rib', 'sternum'],
    'abdomen': ['abdomen', 'abdominal'],
    'pelvis': ['pelvis', 'pelvic'],
    
    // Organs
    'heart': ['heart', 'cardiac', 'coronary'],
    'lung': ['lung', 'pulmonary'],
    'liver': ['liver', 'hepatic'],
    'kidney': ['kidney', 'renal'],
    'brain': ['brain', 'cerebral', 'intracranial']
  };
  
  // Check for each anatomical region
  for (const [region, keywords] of Object.entries(anatomyMap)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword) || lowerCode.includes(keyword)) {
        sites.push(region);
        break; // Only add region once
      }
    }
  }
  
  // Special handling for ICD codes - BE SPECIFIC, don't generalize
  // S02 = Head/face fractures
  if (code?.match(/^S02/)) {
    if (!sites.includes('mandible') && !sites.includes('maxilla') && !sites.includes('skull')) {
      sites.push('face');  // Changed from 'head' to 'face' - more specific
    }
  }
  // S42 = Shoulder girdle - DON'T add generic "shoulder", already extracted from text
  // S52 = Forearm (radius/ulna)
  if (code?.match(/^S52/)) {
    if (!sites.includes('radius') && !sites.includes('ulna')) {
      sites.push('forearm');
    }
  }
  // S72 = Femur - only if not already detected
  if (code?.match(/^S72/) && !sites.includes('femur')) {
    sites.push('femur');
  }
  // S82 = Lower leg (tibia/fibula)
  if (code?.match(/^S82/)) {
    if (!sites.includes('tibia') && !sites.includes('fibula')) {
      sites.push('tibia');
    }
  }
  
  // CPT Code Range Mapping (for better precision)
  // 23xxx series = Mixed shoulder region - need to be VERY specific
  if (code?.match(/^23\d{3}$/)) {
    const codeNum = parseInt(code);
    // 23500-23552 = Clavicle procedures ONLY
    if (codeNum >= 23500 && codeNum <= 23552) {
      if (!sites.includes('clavicle')) sites.push('clavicle');
    }
    // 23570-23680 = Scapula procedures  
    else if (codeNum >= 23570 && codeNum <= 23680) {
      if (!sites.includes('scapula')) sites.push('scapula');
    }
    // 23615-23630 = Proximal humerus (shoulder end) = HUMERUS not clavicle!
    else if (codeNum >= 23600 && codeNum <= 23630) {
      if (!sites.includes('humerus')) sites.push('humerus');
    }
    // 23000-23499 = General shoulder/clavicle area
    else if (codeNum < 23500) {
      // Could be either, check description keywords
    }
  }
  
  // 24xxx series = Humerus shaft & Elbow  
  if (code?.match(/^24\d{3}$/)) {
    if (!sites.includes('humerus') && !sites.includes('elbow')) {
      sites.push('humerus');
    }
  }
  
  // 25xxx series = Radius, Ulna, Wrist
  if (code?.match(/^25\d{3}$/)) {
    if (!sites.includes('radius') && !sites.includes('ulna') && !sites.includes('wrist')) {
      sites.push('radius');  // Default to radius for forearm codes
    }
  }
  
  // 26xxx series = Hand/fingers
  if (code?.match(/^26\d{3}$/)) {
    if (!sites.includes('hand')) sites.push('hand');
  }
  
  // 27xxx series = Hip, Femur, Knee, Lower extremity
  if (code?.match(/^27\d{3}$/)) {
    // Be very specific based on code range
    const codeNum = parseInt(code);
    if (codeNum >= 27000 && codeNum <= 27036) sites.push('pelvis');
    else if (codeNum >= 27040 && codeNum <= 27299) sites.push('hip');
    else if (codeNum >= 27300 && codeNum <= 27599) sites.push('femur');
    else if (codeNum >= 27600 && codeNum <= 27899) sites.push('knee');
  }
  
  // 28xxx series = Foot & ankle
  if (code?.match(/^28\d{3}$/)) {
    if (!sites.includes('foot') && !sites.includes('ankle')) {
      sites.push('foot');
    }
  }
  
  return [...new Set(sites)]; // Remove duplicates
}

/**
 * Check if anatomical sites match between ICD and CPT
 * Returns true if there's any overlap in body regions
 */
function checkAnatomicalMatch(icdSites, cptSites) {
  if (icdSites.length === 0 || cptSites.length === 0) {
    return true; // No anatomical info available, can't validate
  }
  
  // Check for exact matches
  for (const icdSite of icdSites) {
    if (cptSites.includes(icdSite)) {
      return true;
    }
  }
  
  // Check for related anatomical regions
  // IMPORTANT: Only include truly interchangeable sites, not just proximity
  const relatedRegions = {
    // Head/Face - can be related for imaging
    'mandible': ['face', 'maxilla'],  // Removed skull/head - too broad
    'maxilla': ['face', 'mandible'],
    
    // Specific bones - NO cross-bone matching for fractures!
    'clavicle': [],  // Clavicle is distinct - no related regions
    'scapula': [],   // Scapula is distinct
    'humerus': [],   // Humerus is distinct - NOT related to clavicle
    
    // Forearm bones - can be related for forearm procedures
    'radius': ['forearm'],  // Removed wrist/elbow - too broad
    'ulna': ['forearm'],
    'forearm': ['radius', 'ulna'],  // Forearm procedures cover both bones
    
    // Lower leg bones
    'tibia': ['fibula'],  // Lower leg fractures often involve both
    'fibula': ['tibia'],
    
    // Joints - very specific
    'wrist': [],  // Removed hand - separate procedures
    'hand': [],   // Distinct from wrist
    'elbow': [],  // Distinct joint
    'knee': [],   // Distinct joint
    'ankle': [],  // Distinct joint
    
    // Long bones - no related regions (each is specific)
    'femur': [],  // Removed hip/knee - femur is distinct
    'hip': [],    // Hip joint is distinct
    'foot': []
  };
  
  for (const icdSite of icdSites) {
    const related = relatedRegions[icdSite] || [];
    for (const relatedSite of related) {
      if (cptSites.includes(relatedSite)) {
        return true;
      }
    }
  }
  
  return false; // No anatomical match found
}

/**
 * Validate medical appropriateness of ICD-CPT links
 * Uses clinical guidelines and NICE care pathways logic with strict domain matching
 * @param {Object} icd - ICD code object with details
 * @param {Array} cptSuggestions - Array of suggested CPT codes
 * @returns {Array} Validated and scored CPT suggestions
 */
async function validateMedicalLinking(icd, cptSuggestions) {
  try {
    console.log(`🔍 Validating ${cptSuggestions.length} CPT suggestions for ICD ${icd.code}`);
    
    // Medical validation rules based on NICE care pathways
    const validatedSuggestions = cptSuggestions.map(cpt => {
      let validationScore = cpt.similarity || 0.5;
      let clinicalReasoning = [];
      let penalties = [];
      
      // CRITICAL: Detect and penalize domain mismatches
      
      // Rule 0: BLOCK cardiovascular procedures for non-cardiac conditions
      if (cpt.short_description?.match(/cardiovascular|cardiac|heart|ekg|ecg|stress test/i) &&
          !icd.title?.match(/heart|cardiac|cardiovascular|myocardial/i) &&
          !icd.code?.match(/^I[0-5]\d/)) {
        validationScore -= 0.8; // Severe penalty
        penalties.push('REJECTED: Cardiovascular procedure inappropriate for this diagnosis');
      }
      
      // Rule 0b: BLOCK obstetric procedures for non-pregnancy conditions
      if (cpt.short_description?.match(/fetal|obstetric|pregnancy|prenatal|biophys/i) &&
          !icd.title?.match(/pregnancy|fetal|obstetric|maternal/i) &&
          !icd.code?.match(/^O\d/)) {
        validationScore -= 0.8; // Severe penalty
        penalties.push('REJECTED: Obstetric procedure inappropriate for this diagnosis');
      }
      
      // Rule 0c: BLOCK neurological procedures for non-neuro conditions
      if (cpt.short_description?.match(/brain|neurolog|cranial|cerebral/i) &&
          !icd.title?.match(/brain|neurolog|cranial|cerebral|head/i) &&
          !icd.code?.match(/^[GS][0-4]\d/)) {
        validationScore -= 0.8;
        penalties.push('REJECTED: Neurological procedure inappropriate');
      }
      
      // Rule 0d: BLOCK congenital repair procedures for non-congenital conditions
      if (cpt.short_description?.match(/cleft|congenital|malformation/i) &&
          !icd.title?.match(/congenital|cleft|malformation/i) &&
          !icd.code?.match(/^Q\d/)) {
        validationScore -= 0.9;
        penalties.push('REJECTED: Congenital repair procedure for non-congenital condition');
      }
      
      // Rule 0e: BLOCK abdominal organ surgery for non-abdominal conditions
      if (cpt.short_description?.match(/liver|hepatic|spleen|pancrea|gallbladder|colon|intestin/i) &&
          !icd.title?.match(/liver|hepatic|spleen|pancrea|gallbladder|colon|intestin|abdom/i) &&
          !icd.code?.match(/^[KR]\d/)) {
        validationScore -= 0.9;
        penalties.push('REJECTED: Abdominal organ surgery inappropriate for this diagnosis');
      }
      
      // Rule 0f: BLOCK upper extremity procedures for lower extremity conditions and vice versa
      const icdIsUpperExtremity = icd.code?.match(/^S[4-6]\d/) || icd.title?.match(/arm|shoulder|elbow|wrist|hand|finger|radius|ulna|humerus/i);
      const icdIsLowerExtremity = icd.code?.match(/^S[7-9]\d/) || icd.title?.match(/leg|hip|knee|ankle|foot|toe|femur|tibia|fibula/i);
      const cptIsUpperExtremity = cpt.code?.match(/^2[3-6]\d{3}/) || cpt.short_description?.match(/arm|shoulder|elbow|wrist|hand|finger|radius|ulna|humerus/i);
      const cptIsLowerExtremity = cpt.code?.match(/^2[7-9]\d{3}/) || cpt.short_description?.match(/leg|hip|knee|ankle|foot|toe|femur|tibia|fibula/i);
      
      if (icdIsUpperExtremity && cptIsLowerExtremity) {
        validationScore -= 0.8;
        penalties.push('REJECTED: Lower extremity procedure for upper extremity condition');
      }
      if (icdIsLowerExtremity && cptIsUpperExtremity) {
        validationScore -= 0.8;
        penalties.push('REJECTED: Upper extremity procedure for lower extremity condition');
      }
      
      // POSITIVE RULES: Boost appropriate pairings
      
      // Rule 1: Fracture codes MUST get fracture-related procedures WITH ANATOMICAL MATCHING
      if (icd.title?.match(/fracture/i)) {
        // Extract anatomical site from ICD
        const icdAnatomySites = extractAnatomicalSites(icd.title, icd.code);
        const cptAnatomySites = extractAnatomicalSites(cpt.short_description + ' ' + cpt.display, cpt.code);
        
        // Debug logging for anatomical extraction
        if (cpt.code === '23515' || cpt.code === '23500' || cpt.code === '23616') {
          console.log(`      🔬 ${cpt.code}: ICD sites=[${icdAnatomySites.join(',')}] CPT sites=[${cptAnatomySites.join(',')}]`);
        }
        
        // Check anatomical match
        const anatomyMatch = checkAnatomicalMatch(icdAnatomySites, cptAnatomySites);
        
        if (!anatomyMatch && cptAnatomySites.length > 0) {
          // BLOCK wrong anatomical site for fractures
          validationScore -= 0.7;
          penalties.push(`REJECTED: Wrong anatomical site - ICD is ${icdAnatomySites.join('/')} but CPT is for ${cptAnatomySites.join('/')}`);
        } else if (anatomyMatch) {
          // Boost surgical fracture repair for CORRECT anatomical site
          if (cpt.chapter?.includes('Surgery') && 
              cpt.short_description?.match(/fracture|repair|fix|osteotomy|orif|reduction/i)) {
            validationScore += 0.4;
            clinicalReasoning.push(`Surgical fracture treatment for ${icdAnatomySites.join('/')}`);
          }
          
          // Boost imaging for fractures at CORRECT anatomical site
          if (cpt.chapter?.includes('Radiology') && 
              cpt.short_description?.match(/xray|x-ray|radiolog|ct|mri|scan/i)) {
            validationScore += 0.3;
            clinicalReasoning.push(`Imaging for ${icdAnatomySites.join('/')} fracture`);
          }
          
          // Boost casting/splinting for correct site
          if (cpt.short_description?.match(/cast|splint|immobil/i)) {
            validationScore += 0.25;
            clinicalReasoning.push('Fracture immobilization');
          }
        }
      }
      
      // Rule 2: Musculoskeletal codes (M codes) need MSK procedures
      if (icd.code?.match(/^M\d/) && 
          (cpt.chapter?.includes('Surgery') || cpt.chapter?.includes('Medicine')) &&
          cpt.short_description?.match(/bone|joint|muscle|tendon|ligament|orthopedic/i)) {
        validationScore += 0.25;
        clinicalReasoning.push('Musculoskeletal procedure for MSK condition');
      }
      
      // Rule 3: Diagnostic procedures for infectious diseases
      if (icd.chapter?.includes('Infectious') && 
          (cpt.chapter?.includes('Pathology') || 
           cpt.chapter?.includes('Category II') ||
           cpt.short_description?.match(/culture|test|specimen|pathogen/i))) {
        validationScore += 0.2;
        clinicalReasoning.push('Diagnostic testing for infectious disease');
      }
      
      // Rule 4: Injury codes (S codes) need injury-specific procedures
      if (icd.code?.match(/^S\d/)) {
        if (cpt.chapter?.includes('Surgery') && 
            cpt.short_description?.match(/repair|treat|closure|debride/i)) {
          validationScore += 0.25;
          clinicalReasoning.push('Surgical treatment for injury');
        }
        
        if (cpt.chapter?.includes('Radiology')) {
          validationScore += 0.2;
          clinicalReasoning.push('Imaging for trauma evaluation');
        }
      }
      
      // Rule 5: Monitoring for chronic conditions
      if ((icd.code?.match(/^E1[01]/) || icd.code?.match(/^I1[0-5]/)) &&
          cpt.short_description?.match(/blood|glucose|pressure|monitor|screen/i)) {
        validationScore += 0.2;
        clinicalReasoning.push('Monitoring for chronic condition');
      }
      
      // Rule 5b: Thyroid function tests for thyroid disorders (PRIORITY BOOST)
      if (icd.code?.match(/^E0[0-7]/) && 
          cpt.short_description?.match(/thyroid|tsh|t3|t4|thyroxine/i)) {
        validationScore += 0.45; // Strong boost for thyroid tests
        clinicalReasoning.push('Thyroid function testing for thyroid disorder');
      }
      
      // Rule 5c: Laboratory/Pathology for diagnostic workup
      if ((cpt.chapter?.includes('Pathology') || cpt.chapter?.includes('Laboratory') || cpt.chapter?.includes('Category II')) &&
          (icd.chapter?.includes('Endocrine') || icd.chapter?.includes('Infectious') || icd.chapter?.includes('Blood'))) {
        validationScore += 0.30; // Increased boost for lab diagnostic workup
        clinicalReasoning.push('Laboratory diagnostic workup');
      }
      
      // Rule 5d: Lab tests are ALWAYS appropriate for most diagnostic workups
      if (cpt.chapter?.includes('Pathology') || cpt.chapter?.includes('Laboratory')) {
        validationScore += 0.10; // General boost for lab tests
        clinicalReasoning.push('Laboratory testing');
      }
      
      // Rule 6: Penalize cross-domain mismatches
      if (icd.chapter?.includes('Mental') && 
          cpt.chapter?.includes('Surgery') &&
          !cpt.short_description?.match(/psychiatric|mental/i)) {
        validationScore -= 0.5;
        penalties.push('Surgical procedure inappropriate for mental health condition');
      }
      
      // Rule 7: Sequela codes (S suffix) - follow-up care
      if (icd.code?.match(/S$/)) {
        // Boost E&M codes for sequela follow-up
        if (cpt.code?.match(/^99[12]\d{2}/) || 
            cpt.short_description?.match(/office visit|outpatient visit|evaluation|exam/i)) {
          validationScore += 0.2;
          clinicalReasoning.push('Follow-up evaluation for sequela');
        }
        
        // Boost rehabilitation/therapy
        if (cpt.short_description?.match(/rehab|therapy|physical therapy|occupational/i)) {
          validationScore += 0.2;
          clinicalReasoning.push('Rehabilitation for sequela');
        }
        
        // Boost continued imaging follow-up
        if (cpt.chapter?.includes('Radiology')) {
          validationScore += 0.15;
          clinicalReasoning.push('Follow-up imaging for healing assessment');
        }
      }
      
      // Rule 8: NICE Care Pathway - Imaging first for fractures
      if (icd.title?.match(/fracture/i) && 
          cpt.chapter?.includes('Radiology') &&
          checkAnatomicalMatch(extractAnatomicalSites(icd.title, icd.code), 
                              extractAnatomicalSites(cpt.short_description + ' ' + cpt.display, cpt.code))) {
        validationScore += 0.3;
        clinicalReasoning.push('NICE pathway: Imaging assessment for fracture');
      }
      
      // Cap score at 0.95 (never 100% certain)
      validationScore = Math.min(validationScore, 0.95);
      
      // Determine final status - stricter threshold
      const finalStatus = validationScore >= 0.65 ? 'approved' : 'rejected';
      
      // Log rejections
      if (finalStatus === 'rejected' && penalties.length > 0) {
        console.log(`   ❌ ${cpt.code}: ${penalties.join('; ')} (score: ${validationScore.toFixed(2)})`);
      } else if (finalStatus === 'approved') {
        console.log(`   ✅ ${cpt.code}: ${clinicalReasoning.join('; ')} (score: ${validationScore.toFixed(2)})`);
      }
      
      return {
        ...cpt,
        confidence_score: validationScore,
        relationship_type: determineRelationshipType(icd, cpt),
        clinical_context: [...clinicalReasoning, ...penalties].join('; ') || 'Related procedure',
        validation_status: finalStatus
      };
    });
    
    // Filter out rejected suggestions and sort by validation score
    const approved = validatedSuggestions
      .filter(s => s.validation_status === 'approved')
      .sort((a, b) => b.confidence_score - a.confidence_score);
    
    console.log(`   📊 Validation result: ${approved.length}/${cptSuggestions.length} approved`);
    
    return approved;
    
  } catch (error) {
    console.error('❌ Error in medical validation:', error);
    // Return original suggestions if validation fails
    return cptSuggestions;
  }
}

/**
 * Determine the relationship type between ICD and CPT
 * Based on NICE care pathway logic
 */
function determineRelationshipType(icd, cpt) {
  // Diagnostic relationship
  if (cpt.chapter?.includes('Pathology') || cpt.short_description?.match(/test|culture|specimen|biopsy/i)) {
    return 'diagnostic';
  }
  
  // Therapeutic/Surgical relationship
  if (cpt.chapter?.includes('Surgery') || cpt.short_description?.match(/repair|excision|removal|replacement/i)) {
    return 'therapeutic';
  }
  
  // Monitoring relationship
  if (cpt.short_description?.match(/blood|glucose|pressure|monitor|screening/i)) {
    return 'monitoring';
  }
  
  // Imaging relationship
  if (cpt.chapter?.includes('Radiology') || cpt.short_description?.match(/xray|ct|mri|ultrasound|scan/i)) {
    return 'imaging';
  }
  
  return 'related';
}

export default {
  query,
  getICDSuggestions,
  getICDSpecifiers,
  getCPTSuggestions,
  getCPTForICD,
  testConnection,
  closePool
};

