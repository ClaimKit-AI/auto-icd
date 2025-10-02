// ICD Suggest & Specifier Tray - Generate All Embeddings
// This script generates AI embeddings for all loaded ICD codes with optimized batching

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

/**
 * Get count of codes without embeddings
 */
async function getEmbeddingStats() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_codes,
        COUNT(title_embedding) as codes_with_embeddings,
        COUNT(*) - COUNT(title_embedding) as codes_without_embeddings
      FROM icd_codes
    `);
    
    return result.rows[0];
  } catch (error) {
    console.error('Error getting embedding stats:', error);
    throw error;
  }
}

/**
 * Generate embeddings for all ICD codes without embeddings
 */
async function generateAllEmbeddings() {
  console.log('🤖 Starting AI embedding generation for all ICD codes...');
  
  try {
    // Get statistics
    const stats = await getEmbeddingStats();
    console.log('📊 Database Statistics:');
    console.log(`   Total codes: ${stats.total_codes}`);
    console.log(`   Codes with embeddings: ${stats.codes_with_embeddings}`);
    console.log(`   Codes without embeddings: ${stats.codes_without_embeddings}`);
    
    if (stats.codes_without_embeddings === 0) {
      console.log('✅ All codes already have embeddings!');
      return true;
    }
    
    // Get all codes without embeddings
    const result = await pool.query(`
      SELECT code, title, synonyms, chapter
      FROM icd_codes 
      WHERE title_embedding IS NULL
      ORDER BY code
    `);
    
    const codes = result.rows;
    console.log(`📋 Processing ${codes.length} codes without embeddings...`);
    
    // Process in optimized batches
    const batchSize = 5; // Smaller batches to avoid rate limits
    let processed = 0;
    let successful = 0;
    let failed = 0;
    const startTime = Date.now();
    
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      const batchNumber = Math.floor(i/batchSize) + 1;
      const totalBatches = Math.ceil(codes.length/batchSize);
      
      console.log(`🔄 Processing batch ${batchNumber}/${totalBatches} (${batch.length} codes)`);
      
      // Process batch in parallel
      const embeddingPromises = batch.map(async (icdCode, index) => {
        try {
          // Create comprehensive search text
          const synonyms = icdCode.synonyms ? icdCode.synonyms.join(' ') : '';
          const searchText = `${icdCode.code} ${icdCode.title} ${synonyms} ${icdCode.chapter || ''}`;
          
          console.log(`  📝 [${i + index + 1}/${codes.length}] Generating embedding for: ${icdCode.code}`);
          const embedding = await generateEmbedding(searchText);
          
          return {
            code: icdCode.code,
            embedding: embedding,
            success: true
          };
        } catch (error) {
          console.error(`  ❌ [${i + index + 1}/${codes.length}] Error generating embedding for ${icdCode.code}:`, error.message);
          return {
            code: icdCode.code,
            embedding: null,
            success: false,
            error: error.message
          };
        }
      });
      
      const embeddings = await Promise.all(embeddingPromises);
      
      // Store embeddings in database
      for (const result of embeddings) {
        if (result.success && result.embedding) {
          try {
            await pool.query(`
              UPDATE icd_codes 
              SET title_embedding = $1::vector
              WHERE code = $2
            `, [JSON.stringify(result.embedding), result.code]);
            
            successful++;
            console.log(`  ✅ Stored embedding for: ${result.code}`);
          } catch (error) {
            console.error(`  ❌ Error storing embedding for ${result.code}:`, error.message);
            failed++;
          }
        } else {
          failed++;
        }
        processed++;
      }
      
      // Progress update
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = codes.length - processed;
      const eta = remaining / rate;
      
      console.log(`📈 Progress: ${processed}/${codes.length} (${((processed/codes.length)*100).toFixed(1)}%)`);
      console.log(`⏱️  Rate: ${rate.toFixed(1)} codes/sec, ETA: ${Math.round(eta/60)} minutes`);
      console.log(`✅ Successful: ${successful}, ❌ Failed: ${failed}`);
      
      // Rate limiting - wait between batches
      if (i + batchSize < codes.length) {
        console.log('  ⏳ Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(`🎉 Embedding generation completed!`);
    console.log(`📊 Final Statistics:`);
    console.log(`   Total processed: ${processed}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total time: ${Math.round(totalTime/60)} minutes`);
    console.log(`   Average rate: ${(processed/totalTime).toFixed(1)} codes/sec`);
    
    // Test the vector search
    console.log('🧪 Testing vector search with full dataset...');
    const testResult = await pool.query(`
      SELECT code, title, 1 - (title_embedding <=> $1::vector) as similarity
      FROM icd_codes 
      WHERE title_embedding IS NOT NULL
      ORDER BY title_embedding <=> $1::vector
      LIMIT 5
    `, [JSON.stringify(new Array(1536).fill(0.1))]);
    
    console.log('✅ Vector search test successful');
    console.log('📊 Top 5 similar codes:', testResult.rows.map(r => `${r.code}: ${r.similarity.toFixed(4)}`));
    
    return true;
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error);
    return false;
  }
}

/**
 * Resume embedding generation (for interrupted processes)
 */
async function resumeEmbeddingGeneration() {
  console.log('🔄 Resuming embedding generation...');
  
  try {
    const stats = await getEmbeddingStats();
    console.log(`📊 Found ${stats.codes_without_embeddings} codes still needing embeddings`);
    
    if (stats.codes_without_embeddings === 0) {
      console.log('✅ All codes already have embeddings!');
      return true;
    }
    
    return await generateAllEmbeddings();
    
  } catch (error) {
    console.error('❌ Error resuming embedding generation:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting AI embedding generation for ICD-10-CM dataset...');
  console.log('💰 Estimated cost: ~$1.36 for 67,965 codes');
  console.log('⏱️  Estimated time: 2-3 hours with rate limiting');
  console.log('');
  
  try {
    const success = await generateAllEmbeddings();
    
    if (success) {
      console.log('🎉 AI embedding generation completed successfully!');
      console.log('🚀 Your RAG system now has full AI-powered semantic search!');
      console.log('📝 Next steps:');
      console.log('   1. Restart the backend server');
      console.log('   2. Test the AI-powered search with semantic capabilities');
      console.log('   3. Enjoy intelligent ICD code suggestions!');
    } else {
      console.log('💥 AI embedding generation failed!');
      console.log('🔄 You can resume by running this script again');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    console.log('🔄 You can resume by running this script again');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();
