// ICD Suggest & Specifier Tray - Generate Embeddings
// This script generates AI embeddings for all ICD codes using OpenAI

import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embedding for text using OpenAI's text-embedding-3-small model
 */
async function generateEmbedding(text) {
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

async function generateEmbeddingsForAllCodes() {
  console.log('🤖 Generating AI embeddings for all ICD codes...');
  
  try {
    // Get all ICD codes that don't have embeddings yet
    const result = await pool.query(`
      SELECT code, title, synonyms, chapter, block, category
      FROM icd_codes 
      WHERE title_embedding IS NULL
      ORDER BY code
    `);
    
    const codes = result.rows;
    console.log(`📊 Found ${codes.length} codes without embeddings`);
    
    if (codes.length === 0) {
      console.log('✅ All codes already have embeddings!');
      return true;
    }
    
    // Process codes in batches to avoid rate limits
    const batchSize = 5;
    let processed = 0;
    
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(codes.length/batchSize)}`);
      
      // Generate embeddings for the batch
      const embeddingPromises = batch.map(async (icdCode) => {
        try {
          // Create search text combining code, title, synonyms, and metadata
          const synonyms = icdCode.synonyms ? icdCode.synonyms.join(' ') : '';
          const searchText = `${icdCode.code} ${icdCode.title} ${synonyms} ${icdCode.chapter} ${icdCode.block} ${icdCode.category}`;
          
          console.log(`  📝 Generating embedding for: ${icdCode.code} - ${icdCode.title}`);
          const embedding = await generateEmbedding(searchText);
          
          return {
            code: icdCode.code,
            embedding: embedding
          };
        } catch (error) {
          console.error(`  ❌ Error generating embedding for ${icdCode.code}:`, error.message);
          return null;
        }
      });
      
      const embeddings = await Promise.all(embeddingPromises);
      
      // Store embeddings in database
      for (const result of embeddings) {
        if (result) {
          try {
            await pool.query(`
              UPDATE icd_codes 
              SET title_embedding = $1::vector
              WHERE code = $2
            `, [JSON.stringify(result.embedding), result.code]);
            
            processed++;
            console.log(`  ✅ Stored embedding for: ${result.code}`);
          } catch (error) {
            console.error(`  ❌ Error storing embedding for ${result.code}:`, error.message);
          }
        }
      }
      
      // Rate limiting - wait 2 seconds between batches
      if (i + batchSize < codes.length) {
        console.log('  ⏳ Waiting 2 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    console.log(`🎉 Successfully generated embeddings for ${processed} ICD codes`);
    
    // Test the vector search
    console.log('🧪 Testing vector search...');
    const testResult = await pool.query(`
      SELECT code, title, 1 - (title_embedding <=> $1::vector) as similarity
      FROM icd_codes 
      WHERE title_embedding IS NOT NULL
      ORDER BY title_embedding <=> $1::vector
      LIMIT 3
    `, [JSON.stringify(new Array(1536).fill(0.1))]);
    
    console.log('✅ Vector search test successful');
    console.log('📊 Test results:', testResult.rows.map(r => `${r.code}: ${r.similarity.toFixed(4)}`));
    
    return true;
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    return false;
  } finally {
    await pool.end();
  }
}

// Run the embedding generation
generateEmbeddingsForAllCodes()
  .then((success) => {
    if (success) {
      console.log('🎉 RAG system is now fully operational!');
      console.log('🚀 Your AI-powered ICD search is ready!');
      console.log('📝 You can now:');
      console.log('   1. Start the backend server');
      console.log('   2. Test the AI-powered search in the frontend');
      console.log('   3. Enjoy intelligent ICD code suggestions!');
    } else {
      console.log('💥 Embedding generation failed!');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
