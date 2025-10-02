// ICD Suggest & Specifier Tray - Data Loader
// This script loads mock ICD data into your Supabase database
// Run this after setting up your Supabase project and schema

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// DATABASE CONNECTION
// =============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.efijoenjahkldathipjl:gaddouhaA1%40%40@aws-1-us-east-2.pooler.supabase.com:5432/postgres',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// =============================================================================
// DATA LOADING FUNCTIONS
// =============================================================================

/**
 * Load ICD codes from CSV file
 */
async function loadICDCodes() {
  console.log('📊 Loading ICD codes...');
  
  const csvPath = path.join(__dirname, 'seed_icd.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  const dataLines = lines.slice(1);
  
  let loaded = 0;
  let errors = 0;
  
  for (const line of dataLines) {
    if (!line.trim()) continue;
    
    try {
      // Parse CSV line with proper JSON handling
      const fields = [];
      let current = '';
      let inQuotes = false;
      let i = 0;
      
      while (i < line.length) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Escaped quote
            current += '"';
            i += 2;
          } else {
            // Toggle quote state
            inQuotes = !inQuotes;
            i++;
          }
        } else if (char === ',' && !inQuotes) {
          fields.push(current);
          current = '';
          i++;
        } else {
          current += char;
          i++;
        }
      }
      fields.push(current); // Add the last field
      
      const [code, title, normalized_title, synonyms, chapter, block, category, parents, has_specifiers] = fields;
      
      // Insert into database
      await pool.query(`
        INSERT INTO icd_codes (code, title, normalized_title, synonyms, chapter, block, category, parents, has_specifiers)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (code) DO UPDATE SET
          title = EXCLUDED.title,
          normalized_title = EXCLUDED.normalized_title,
          synonyms = EXCLUDED.synonyms,
          chapter = EXCLUDED.chapter,
          block = EXCLUDED.block,
          category = EXCLUDED.category,
          parents = EXCLUDED.parents,
          has_specifiers = EXCLUDED.has_specifiers
      `, [
        code,
        title,
        normalized_title,
        synonyms,
        chapter,
        block,
        category,
        parents ? `{${parents.replace(/[{}]/g, '')}}` : '{}',
        has_specifiers === 'true'
      ]);
      
      loaded++;
      if (loaded % 10 === 0) {
        console.log(`  Loaded ${loaded} codes...`);
      }
      
    } catch (error) {
      console.error(`❌ Error loading line: ${line}`, error.message);
      errors++;
    }
  }
  
  console.log(`✅ Loaded ${loaded} ICD codes (${errors} errors)`);
  return { loaded, errors };
}

/**
 * Load specifiers from CSV file
 */
async function loadSpecifiers() {
  console.log('📊 Loading ICD specifiers...');
  
  const csvPath = path.join(__dirname, 'seed_specifiers.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.trim().split('\n');
  
  // Skip header row
  const dataLines = lines.slice(1);
  
  let loaded = 0;
  let errors = 0;
  
  for (const line of dataLines) {
    if (!line.trim()) continue;
    
    try {
      // Parse CSV line
      const [root_code, dimension, code_suffix, label] = 
        line.split(',').map(field => field.replace(/^"|"$/g, ''));
      
      // Insert into database
      await pool.query(`
        INSERT INTO icd_specifiers (root_code, dimension, code_suffix, label)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (root_code, dimension, code_suffix) DO UPDATE SET
          label = EXCLUDED.label
      `, [root_code, dimension, code_suffix, label]);
      
      loaded++;
      
    } catch (error) {
      console.error(`❌ Error loading specifier line: ${line}`, error.message);
      errors++;
    }
  }
  
  console.log(`✅ Loaded ${loaded} specifiers (${errors} errors)`);
  return { loaded, errors };
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    console.log('✅ Database connected successfully');
    console.log(`   Current time: ${result.rows[0].current_time}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Get database statistics
 */
async function getStats() {
  try {
    const codesResult = await pool.query('SELECT COUNT(*) as count FROM icd_codes');
    const specifiersResult = await pool.query('SELECT COUNT(*) as count FROM icd_specifiers');
    
    console.log('\n📈 Database Statistics:');
    console.log(`   ICD Codes: ${codesResult.rows[0].count}`);
    console.log(`   Specifiers: ${specifiersResult.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error getting stats:', error.message);
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main() {
  console.log('🚀 Starting ICD data load...\n');
  
  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.error('❌ Cannot connect to database. Please check your DATABASE_URL in .env');
    process.exit(1);
  }
  
  try {
    // Load data
    await loadICDCodes();
    await loadSpecifiers();
    
    // Show final stats
    await getStats();
    
    console.log('\n🎉 Data loading completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Start your backend: cd apps/api && npm run dev');
    console.log('2. Test the API: curl http://localhost:3000/api/health');
    console.log('3. Try a search: curl "http://localhost:3000/api/suggest?q=hyp"');
    
  } catch (error) {
    console.error('❌ Data loading failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch(console.error);
