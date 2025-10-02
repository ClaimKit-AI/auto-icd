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
    
    // If no pre-computed links, use AI to suggest based on diagnosis
    console.log('🤖 Using AI to suggest appropriate CPT codes...');
    
    // Get the ICD details
    const icdResult = await pool.query(`
      SELECT code, title, chapter, block
      FROM icd_codes
      WHERE code = $1
    `, [icdCode]);
    
    if (icdResult.rows.length === 0) {
      return [];
    }
    
    const icd = icdResult.rows[0];
    
    // Use vector similarity to find related CPT procedures
    // This is a simple approach - searches for CPT codes related to the diagnosis
    const searchQuery = `${icd.title} ${icd.chapter}`;
    const cptResults = await getCPTSuggestions(searchQuery, limit);
    
    return cptResults.map(cpt => ({
      ...cpt,
      relationship_type: 'ai_suggested',
      confidence_score: cpt.similarity || 0.5,
      clinical_context: `Potentially related procedure for: ${icd.title}`
    }));
    
  } catch (error) {
    console.error('❌ Error in getCPTForICD:', error);
    return [];
  }
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

