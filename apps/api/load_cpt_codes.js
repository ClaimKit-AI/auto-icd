// Fast CPT Loader with Batch Embeddings
// Loads 9,942 CPT codes and generates embeddings in under 20 minutes

import { Pool } from 'pg';
import OpenAI from 'openai';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate embeddings in batch for efficiency
 */
async function generateBatchEmbeddings(texts) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Fast and cost-effective
      input: texts // Batch input
    });
    
    return response.data.map(item => item.embedding);
  } catch (error) {
    console.error('Error generating batch embeddings:', error.message);
    throw error;
  }
}

/**
 * Load CPT data from Excel
 */
async function loadCPTExcel() {
  console.log('📊 Loading CPT data from Excel...\n');
  
  const workbook = XLSX.readFile('../../CPT - fatma aljabri.xlsx');
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`✅ Loaded ${data.length} CPT codes\n`);
  return data;
}

/**
 * Map Excel row to CPT schema
 */
function mapCPTRow(row) {
  return {
    code: (row['CODE'] || '').toString().trim(),
    display: (row['DISPLAY'] || '').toString().trim(),
    short_description: (row['short_description'] || '').toString().trim(),
    medium_description: (row['medium_description'] || '').toString().trim(),
    normalized_display: (row['DISPLAY'] || '').toString().toLowerCase().trim(),
    chapter: (row['chapter_description'] || '').toString().trim(),
    subchapter: (row['subchapter_description'] || '').toString().trim(),
    code_range: (row['chapter coderange'] || '').toString().trim(),
    active: row['active'] === true || row['active'] === 'true',
    activation_date: row['Activation Periods/start'] || null
  };
}

/**
 * Insert CPT codes into database (without embeddings first for speed)
 */
async function insertCPTCodes(cptData) {
  console.log('💾 Inserting CPT codes into database...\n');
  
  let inserted = 0;
  let skipped = 0;
  
  for (const row of cptData) {
    const cpt = mapCPTRow(row);
    
    if (!cpt.code || !cpt.display) {
      skipped++;
      continue;
    }
    
    try {
      await pool.query(`
        INSERT INTO cpt_codes (
          code, display, short_description, medium_description,
          normalized_display, chapter, subchapter, code_range,
          active, activation_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (code) DO UPDATE SET
          display = EXCLUDED.display,
          short_description = EXCLUDED.short_description,
          updated_at = now()
      `, [
        cpt.code, cpt.display, cpt.short_description, cpt.medium_description,
        cpt.normalized_display, cpt.chapter, cpt.subchapter, cpt.code_range,
        cpt.active, cpt.activation_date
      ]);
      
      inserted++;
      
      if (inserted % 500 === 0) {
        console.log(`   ✓ Inserted ${inserted}/${cptData.length} codes...`);
      }
    } catch (error) {
      console.error(`   ❌ Error inserting ${cpt.code}:`, error.message);
      skipped++;
    }
  }
  
  console.log(`\n✅ Inserted: ${inserted} codes`);
  console.log(`⚠️  Skipped: ${skipped} codes\n`);
  
  return inserted;
}

/**
 * Generate and store embeddings in optimized batches
 */
async function generateAllEmbeddings() {
  console.log('🤖 Generating AI embeddings for CPT codes...\n');
  
  // Get all codes without embeddings
  const result = await pool.query(`
    SELECT code, display, short_description
    FROM cpt_codes
    WHERE display_embedding IS NULL
    AND active = true
    ORDER BY code
  `);
  
  const codes = result.rows;
  console.log(`📋 Processing ${codes.length} codes without embeddings\n`);
  
  if (codes.length === 0) {
    console.log('✅ All codes already have embeddings!\n');
    return;
  }
  
  // Batch settings for speed
  const BATCH_SIZE = 50; // Process 50 at a time
  const DELAY_MS = 100;  // Small delay to avoid rate limits
  
  let processed = 0;
  let successful = 0;
  let failed = 0;
  
  const startTime = Date.now();
  
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(codes.length / BATCH_SIZE);
    
    console.log(`🔄 Batch ${batchNum}/${totalBatches} (${batch.length} codes)`);
    
    try {
      // Create search texts for the batch
      const searchTexts = batch.map(c => 
        `${c.code} ${c.display} ${c.short_description || ''}`
      );
      
      // Generate embeddings for the entire batch
      const embeddings = await generateBatchEmbeddings(searchTexts);
      
      // Store each embedding
      for (let j = 0; j < batch.length; j++) {
        try {
          await pool.query(
            'UPDATE cpt_codes SET display_embedding = $1 WHERE code = $2',
            [JSON.stringify(embeddings[j]), batch[j].code]
          );
          successful++;
        } catch (error) {
          console.error(`   ❌ Failed to store ${batch[j].code}`);
          failed++;
        }
      }
      
      processed += batch.length;
      
      // Progress update
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = codes.length - processed;
      const eta = Math.ceil(remaining / rate);
      
      console.log(`   ✅ Progress: ${processed}/${codes.length} (${(processed/codes.length*100).toFixed(1)}%)`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} codes/sec, ETA: ${Math.floor(eta/60)}m ${eta%60}s\n`);
      
      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < codes.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_MS));
      }
      
    } catch (error) {
      console.error(`   ❌ Batch failed:`, error.message);
      failed += batch.length;
    }
  }
  
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  console.log(`\n🎉 Embedding generation complete!`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   ⏱️  Total time: ${totalTime} minutes\n`);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 CPT Code Loader - Fast Batch Processing\n');
  console.log('='.repeat(50)+'\n');
  
  try {
    // Step 1: Load Excel data
    const cptData = await loadCPTExcel();
    
    // Step 2: Insert into database (fast - no embeddings)
    await insertCPTCodes(cptData);
    
    // Step 3: Generate embeddings in batches (optimized for speed)
    await generateAllEmbeddings();
    
    console.log('✅ CPT loading complete!\n');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await pool.end();
  }
}

main();

