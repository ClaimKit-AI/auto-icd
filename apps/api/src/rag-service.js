// ICD Suggest & Specifier Tray - RAG Service
// This service provides AI-powered search capabilities using vector embeddings
// and retrieval-augmented generation for intelligent ICD code suggestions

import OpenAI from 'openai';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Initialize OpenAI client for embeddings
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key-here'
});

// Initialize PostgreSQL connection for vector operations
let pool = null;
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
}

/**
 * Generate embeddings for text using OpenAI's text-embedding-3-small model
 * @param {string} text - Text to generate embedding for
 * @returns {Array<number>} - 1536-dimensional embedding vector
 */
export async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float'
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error('Failed to generate embedding');
  }
}

/**
 * Generate embeddings for ICD codes and store them in the database
 * @param {Array} icdCodes - Array of ICD code objects
 */
export async function generateAndStoreEmbeddings(icdCodes) {
  console.log(`🔄 Generating embeddings for ${icdCodes.length} ICD codes...`);
  
  if (!pool) {
    console.log('⚠️ Database not available, cannot store embeddings');
    return [];
  }
  
  const batchSize = 10; // Process in batches to avoid rate limits
  const results = [];
  
  for (let i = 0; i < icdCodes.length; i += batchSize) {
    const batch = icdCodes.slice(i, i + batchSize);
    
    try {
      // Generate embeddings for the batch
      const embeddingPromises = batch.map(async (icdCode) => {
        const searchText = `${icdCode.code} ${icdCode.title} ${icdCode.synonyms?.join(' ') || ''}`;
        const embedding = await generateEmbedding(searchText);
        
        return {
          code: icdCode.code,
          embedding: embedding
        };
      });
      
      const embeddings = await Promise.all(embeddingPromises);
      
      // Store embeddings in database
      for (const { code, embedding } of embeddings) {
        try {
          await pool.query(
            'UPDATE icd_codes SET title_embedding = $1 WHERE code = $2',
            [JSON.stringify(embedding), code]
          );
          results.push(code);
        } catch (error) {
          console.error(`Error storing embedding for ${code}:`, error);
        }
      }
      
      console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(icdCodes.length/batchSize)}`);
      
      // Rate limiting - wait 1 second between batches
      if (i + batchSize < icdCodes.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`Error processing batch starting at ${i}:`, error);
    }
  }
  
  console.log(`🎉 Successfully generated embeddings for ${results.length} ICD codes`);
  return results;
}

/**
 * Perform vector similarity search for ICD codes
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @param {number} similarityThreshold - Minimum similarity score (0-1)
 * @returns {Array} - Array of similar ICD codes with similarity scores
 */
export async function vectorSearch(query, limit = 10, similarityThreshold = 0.7, table = 'icd') {
  try {
    if (!pool) {
      console.log('⚠️ Database not available, skipping vector search');
      return [];
    }
    
    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);
    
    // Choose table and columns based on type
    if (table === 'cpt') {
      // CPT vector search
      const result = await pool.query(`
        SELECT 
          code,
          display,
          short_description,
          medium_description,
          chapter,
          subchapter,
          1 - (display_embedding <=> $1::vector) as similarity
        FROM cpt_codes 
        WHERE display_embedding IS NOT NULL
          AND active = true
          AND 1 - (display_embedding <=> $1::vector) > $2
        ORDER BY display_embedding <=> $1::vector
        LIMIT $3
      `, [JSON.stringify(queryEmbedding), similarityThreshold, limit]);

      return result.rows || [];
    }
    
    // ICD vector search (default)
    const result = await pool.query(`
      SELECT 
        code,
        title,
        synonyms,
        chapter,
        block,
        category,
        parents,
        has_specifiers,
        1 - (title_embedding <=> $1::vector) as similarity
      FROM icd_codes 
      WHERE title_embedding IS NOT NULL
        AND 1 - (title_embedding <=> $1::vector) > $2
      ORDER BY title_embedding <=> $1::vector
      LIMIT $3
    `, [JSON.stringify(queryEmbedding), similarityThreshold, limit]);

    return result.rows || [];
    
  } catch (error) {
    console.error('Error in vector search:', error);
    throw new Error('Vector search failed');
  }
}

/**
 * Hybrid search combining traditional text search with vector search
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Array} - Combined and ranked results
 */
export async function hybridSearch(query, limit = 10, table = 'icd') {
  try {
    // Perform both traditional and vector search in parallel
    const [traditionalResults, vectorResults] = await Promise.all([
      traditionalTextSearch(query, limit, table),
      vectorSearch(query, limit, 0.5, table) // Lower threshold for vector search
    ]);
    
    // Combine and deduplicate results
    const combinedResults = new Map();
    
    // Add traditional search results with higher weight
    traditionalResults.forEach((result, index) => {
      const score = 1.0 - (index * 0.1); // Decreasing score for traditional results
      combinedResults.set(result.code, {
        ...result,
        search_type: 'traditional',
        combined_score: score
      });
    });
    
    // Add vector search results
    vectorResults.forEach((result) => {
      const existing = combinedResults.get(result.code);
      if (existing) {
        // Combine scores if code exists in both results
        existing.combined_score = Math.max(existing.combined_score, result.similarity);
        existing.search_type = 'hybrid';
      } else {
        combinedResults.set(result.code, {
          ...result,
          search_type: 'vector',
          combined_score: result.similarity
        });
      }
    });
    
    // Sort by combined score and return top results
    return Array.from(combinedResults.values())
      .sort((a, b) => b.combined_score - a.combined_score)
      .slice(0, limit);
      
  } catch (error) {
    console.error('Error in hybrid search:', error);
    // Fallback to traditional search
    return traditionalTextSearch(query, limit, table);
  }
}

/**
 * Traditional text search using PostgreSQL full-text search
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results
 * @returns {Array} - Search results
 */
export async function traditionalTextSearch(query, limit, table = 'icd') {
  try {
    if (!pool) {
      console.log('⚠️ Database not available, skipping traditional search');
      return [];
    }
    
    // CPT traditional search
    if (table === 'cpt') {
      const result = await pool.query(`
        SELECT 
          code,
          display,
          short_description,
          medium_description,
          chapter,
          subchapter
        FROM cpt_codes 
        WHERE active = true
          AND (display ILIKE $1 OR short_description ILIKE $1 OR normalized_display ILIKE $1)
        ORDER BY 
          CASE 
            WHEN short_description ILIKE $2 THEN 1
            WHEN display ILIKE $2 THEN 2
            ELSE 3
          END,
          short_description
        LIMIT $3
      `, [`%${query}%`, `${query}%`, limit]);
      
      return result.rows || [];
    }
    
    // ICD traditional search (default)
    const result = await pool.query(`
      SELECT 
        code,
        title,
        synonyms,
        chapter,
        block,
        category,
        parents,
        has_specifiers
      FROM icd_codes 
      WHERE title ILIKE $1 OR normalized_title ILIKE $1
      ORDER BY 
        CASE 
          WHEN title ILIKE $2 THEN 1
          WHEN normalized_title ILIKE $2 THEN 2
          ELSE 3
        END,
        title
      LIMIT $3
    `, [`%${query}%`, `${query}%`, limit]);
    
    return result.rows || [];
    
  } catch (error) {
    console.error('Error in traditional search:', error);
    return [];
  }
}

/**
 * AI-powered ICD code suggestion with context awareness
 * @param {string} query - User's search query
 * @param {Object} context - Additional context (patient age, symptoms, etc.)
 * @returns {Array} - AI-ranked ICD code suggestions
 */
export async function aiPoweredSuggestions(query, context = {}) {
  try {
    const table = context.table || 'icd'; // Default to ICD
    const limit = context.limit || 20;
    
    // Use hybrid search as base
    const searchResults = await hybridSearch(query, limit, table);
    
    if (searchResults.length === 0) {
      return [];
    }
    
    // Format results based on table type
    if (table === 'cpt') {
      return searchResults.map(result => ({
        code: result.code,
        label: result.short_description || result.display,
        display: result.display,
        fullDisplay: result.display,
        short_description: result.short_description,
        chapter: result.chapter,
        subchapter: result.subchapter,
        similarity: result.similarity,
        confidence: result.combined_score,
        search_type: result.search_type
      }));
    }
    
    // ICD format (default)
    return searchResults.map(result => ({
      code: result.code,
      title: result.title,
      diagnosis: result.title, // Keep both for compatibility
      synonyms: result.synonyms || [],
      chapter: result.chapter,
      has_specifiers: result.has_specifiers,
      confidence: result.combined_score,
      similarity: result.similarity,
      search_type: result.search_type
    }));
    
  } catch (error) {
    console.error('Error in AI-powered suggestions:', error);
    return [];
  }
}

/**
 * Create the vector search function in the database
 * This function needs to be created in Supabase SQL editor
 */
export const createVectorSearchFunction = `
-- Create function for vector similarity search
CREATE OR REPLACE FUNCTION match_icd_codes (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  code text,
  title text,
  synonyms jsonb,
  chapter text,
  has_specifiers boolean,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    icd_codes.code,
    icd_codes.title,
    icd_codes.synonyms,
    icd_codes.chapter,
    icd_codes.has_specifiers,
    1 - (icd_codes.title_embedding <=> query_embedding) AS similarity
  FROM icd_codes
  WHERE 1 - (icd_codes.title_embedding <=> query_embedding) > match_threshold
  ORDER BY icd_codes.title_embedding <=> query_embedding
  LIMIT match_count;
$$;
`;

export default {
  generateEmbedding,
  generateAndStoreEmbeddings,
  vectorSearch,
  hybridSearch,
  aiPoweredSuggestions,
  createVectorSearchFunction
};
