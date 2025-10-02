// Optimized CPT Loader - Resume-capable with better connection handling
import { Pool } from 'pg';
import OpenAI from 'openai';
import XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

// Better pool configuration for long-running operations
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,  // Limit concurrent connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Load CPT data from Excel
 */
function loadCPTExcel() {
  console.log('📊 Loading CPT data from Excel...');
  
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
 * Insert CPT codes in small batches
 */
async function insertCPTCodes(cptData) {
  console.log('💾 Inserting CPT codes into database...\n');
  
  // Check how many already exist
  const checkResult = await pool.query('SELECT COUNT(*) as count FROM cpt_codes');
  const existing = parseInt(checkResult.rows[0].count);
  console.log(`📊 Existing codes in DB: ${existing}\n`);
  
  let inserted = 0;
  let skipped = 0;
  const BATCH_SIZE = 100;  // Process 100 at a time
  
  for (let i = 0; i < cptData.length; i += BATCH_SIZE) {
    const batch = cptData.slice(i, i + BATCH_SIZE);
    
    for (const row of batch) {
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
            updated_at = now()
        `, [
          cpt.code, cpt.display, cpt.short_description, cpt.medium_description,
          cpt.normalized_display, cpt.chapter, cpt.subchapter, cpt.code_range,
          cpt.active, cpt.activation_date
        ]);
        
        inserted++;
      } catch (error) {
        console.error(`   ❌ Error inserting ${cpt.code}:`, error.message);
        skipped++;
      }
    }
    
    // Progress update every batch
    if ((i + BATCH_SIZE) % 500 === 0 || i + BATCH_SIZE >= cptData.length) {
      console.log(`   ✓ Progress: ${Math.min(i + BATCH_SIZE, cptData.length)}/${cptData.length} codes`);
    }
    
    // Small delay to avoid overwhelming the connection
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  console.log(`\n✅ Inserted: ${inserted} codes`);
  console.log(`⚠️  Skipped: ${skipped} codes\n`);
  
  return inserted;
}

/**
 * Generate embeddings in batches
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
  console.log(`📋 Codes needing embeddings: ${codes.length}\n`);
  
  if (codes.length === 0) {
    console.log('✅ All codes already have embeddings!\n');
    return;
  }
  
  const BATCH_SIZE = 100;  // Increased batch size for speed
  let successful = 0;
  let failed = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < codes.length; i += BATCH_SIZE) {
    const batch = codes.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(codes.length / BATCH_SIZE);
    
    try {
      // Create search texts for the batch
      const searchTexts = batch.map(c => 
        `${c.code} ${c.display} ${c.short_description || ''}`
      );
      
      // Generate embeddings for the entire batch
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: searchTexts
      });
      
      const embeddings = response.data.map(item => item.embedding);
      
      // Store each embedding
      for (let j = 0; j < batch.length; j++) {
        try {
          await pool.query(
            'UPDATE cpt_codes SET display_embedding = $1 WHERE code = $2',
            [JSON.stringify(embeddings[j]), batch[j].code]
          );
          successful++;
        } catch (error) {
          failed++;
        }
      }
      
      // Progress update
      const processed = i + batch.length;
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = processed / elapsed;
      const remaining = codes.length - processed;
      const eta = Math.ceil(remaining / rate);
      
      console.log(`🔄 Batch ${batchNum}/${totalBatches} | Progress: ${processed}/${codes.length} (${(processed/codes.length*100).toFixed(1)}%)`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} codes/sec | ETA: ${Math.floor(eta/60)}m ${eta%60}s`);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      console.error(`   ❌ Batch ${batchNum} failed:`, error.message);
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
  console.log('🚀 CPT Code Loader - Optimized & Resume-Capable\n');
  console.log('='.repeat(50)+'\n');
  
  try {
    // Step 1: Load Excel data
    const cptData = loadCPTExcel();
    
    // Step 2: Insert into database
    await insertCPTCodes(cptData);
    
    // Step 3: Generate embeddings
    await generateAllEmbeddings();
    
    console.log('✅ CPT loading complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();

