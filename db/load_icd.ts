// ICD Suggest & Specifier Tray - Data Loading Script
// This script loads ICD codes and specifiers from CSV files into the database

import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import pkg from 'pg';
const { Pool } = pkg;

// =============================================================================
// CONFIGURATION
// =============================================================================

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// File paths
const ICD_CSV_PATH = './db/seed_icd.csv';
const SPECIFIERS_CSV_PATH = './db/seed_specifiers.csv';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse CSV file and return array of objects
 * @param filePath - Path to CSV file
 * @returns Array of parsed objects
 */
function parseCSV(filePath: string): any[] {
  try {
    const fileContent = readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    console.log(`✅ Parsed ${records.length} records from ${filePath}`);
    return records;
  } catch (error) {
    console.error(`❌ Error parsing ${filePath}:`, error);
    return [];
  }
}

/**
 * Load ICD codes into database
 * @param icdRecords - Array of ICD code records
 */
async function loadICDCodes(icdRecords: any[]): Promise<void> {
  if (icdRecords.length === 0) {
    console.log('⚠️ No ICD codes to load');
    return;
  }

  try {
    // Clear existing data
    await pool.query('DELETE FROM icd_codes');
    console.log('🗑️ Cleared existing ICD codes');

    // Prepare batch insert
    const values: any[] = [];
    const placeholders: string[] = [];
    
    icdRecords.forEach((record, index) => {
      const offset = index * 9;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`);
      
      values.push(
        record.code,
        record.title,
        record.normalized_title,
        record.synonyms,
        record.chapter,
        record.has_specifiers === 'true',
        record.block,
        record.category,
        record.parents
      );
    });

    // Execute batch insert
    const query = `
      INSERT INTO icd_codes (code, title, normalized_title, synonyms, chapter, has_specifiers, block, category, parents)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
    console.log(`✅ Loaded ${icdRecords.length} ICD codes`);

  } catch (error) {
    console.error('❌ Error loading ICD codes:', error);
    throw error;
  }
}

/**
 * Load specifiers into database
 * @param specifierRecords - Array of specifier records
 */
async function loadSpecifiers(specifierRecords: any[]): Promise<void> {
  if (specifierRecords.length === 0) {
    console.log('⚠️ No specifiers to load');
    return;
  }

  try {
    // Clear existing data
    await pool.query('DELETE FROM icd_specifiers');
    console.log('🗑️ Cleared existing specifiers');

    // Prepare batch insert
    const values: any[] = [];
    const placeholders: string[] = [];
    
    specifierRecords.forEach((record, index) => {
      const offset = index * 4;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
      
      values.push(
        record.root_code,
        record.dimension,
        record.code_suffix,
        record.label
      );
    });

    // Execute batch insert
    const query = `
      INSERT INTO icd_specifiers (root_code, dimension, code_suffix, label)
      VALUES ${placeholders.join(', ')}
    `;

    await pool.query(query, values);
    console.log(`✅ Loaded ${specifierRecords.length} specifiers`);

  } catch (error) {
    console.error('❌ Error loading specifiers:', error);
    throw error;
  }
}

/**
 * Update database statistics for better performance
 */
async function updateStatistics(): Promise<void> {
  try {
    console.log('📊 Updating database statistics...');
    await pool.query('ANALYZE icd_codes');
    await pool.query('ANALYZE icd_specifiers');
    console.log('✅ Database statistics updated');
  } catch (error) {
    console.error('❌ Error updating statistics:', error);
  }
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main(): Promise<void> {
  console.log('🚀 Starting ICD data loading process...');
  
  try {
    // Check database connection
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection established');

    // Parse CSV files
    const icdRecords = parseCSV(ICD_CSV_PATH);
    const specifierRecords = parseCSV(SPECIFIERS_CSV_PATH);

    // Load data
    await loadICDCodes(icdRecords);
    await loadSpecifiers(specifierRecords);
    
    // Update statistics
    await updateStatistics();

    console.log('🎉 Data loading completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - ICD codes: ${icdRecords.length}`);
    console.log(`   - Specifiers: ${specifierRecords.length}`);

  } catch (error) {
    console.error('💥 Data loading failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  main();
}

export { loadICDCodes, loadSpecifiers, parseCSV };

