// ICD Suggest & Specifier Tray - RAG System Setup
// This script sets up the RAG system using the existing database connection

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupVectorSearchFunction() {
  console.log('🔧 Setting up vector search function...');
  
  try {
    // Create the vector search function
    const createFunctionSQL = `
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
    
    await pool.query(createFunctionSQL);
    console.log('✅ Vector search function created successfully');
    
    // Test the function with a dummy embedding
    console.log('🧪 Testing vector search function...');
    const testEmbedding = new Array(1536).fill(0.1);
    
    const testResult = await pool.query(`
      SELECT * FROM match_icd_codes($1::vector, $2, $3)
    `, [JSON.stringify(testEmbedding), 0.0, 5]);
    
    console.log('✅ Vector search function test successful');
    console.log('📊 Test results:', testResult.rows.length, 'records found');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error setting up vector search function:', error);
    return false;
  }
}

async function checkVectorExtension() {
  console.log('🔍 Checking vector extension...');
  
  try {
    const result = await pool.query(`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Vector extension is installed');
      return true;
    } else {
      console.log('⚠️ Vector extension not found, attempting to install...');
      
      try {
        await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ Vector extension installed successfully');
        return true;
      } catch (installError) {
        console.error('❌ Failed to install vector extension:', installError);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error checking vector extension:', error);
    return false;
  }
}

async function checkEmbeddingColumn() {
  console.log('🔍 Checking embedding column...');
  
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'icd_codes' AND column_name = 'title_embedding'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ title_embedding column exists:', result.rows[0].data_type);
      return true;
    } else {
      console.log('⚠️ title_embedding column not found, creating...');
      
      try {
        await pool.query(`
          ALTER TABLE icd_codes 
          ADD COLUMN title_embedding vector(1536)
        `);
        console.log('✅ title_embedding column created successfully');
        return true;
      } catch (addError) {
        console.error('❌ Failed to add embedding column:', addError);
        return false;
      }
    }
  } catch (error) {
    console.error('❌ Error checking embedding column:', error);
    return false;
  }
}

async function setupRAGSystem() {
  console.log('🚀 Setting up RAG system...');
  
  try {
    // Check and setup prerequisites
    const vectorExtOk = await checkVectorExtension();
    if (!vectorExtOk) {
      console.log('💥 Cannot proceed without vector extension');
      return false;
    }
    
    const embeddingColOk = await checkEmbeddingColumn();
    if (!embeddingColOk) {
      console.log('💥 Cannot proceed without embedding column');
      return false;
    }
    
    // Setup vector search function
    const functionOk = await setupVectorSearchFunction();
    if (!functionOk) {
      console.log('💥 Cannot proceed without vector search function');
      return false;
    }
    
    console.log('🎉 RAG system setup completed successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Add your OpenAI API key to .env file');
    console.log('   2. Run the data loading script to generate embeddings');
    console.log('   3. Test the AI-powered search');
    
    return true;
    
  } catch (error) {
    console.error('❌ Error setting up RAG system:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run the setup
setupRAGSystem()
  .then((success) => {
    if (success) {
      console.log('🎉 RAG system is ready!');
    } else {
      console.log('💥 RAG system setup failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
