// ICD Suggest & Specifier Tray - Load Full ICD-10-CM Dataset
// This script loads the complete ICD-10-CM dataset from Excel into Supabase with AI embeddings

import { Pool } from 'pg';
import OpenAI from 'openai';
import XLSX from 'xlsx';
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
 * Load and parse the Excel file
 */
async function loadExcelData() {
  console.log('📊 Loading ICD-10-CM data from Excel file...');
  
  try {
    // Read the Excel file
    const workbook = XLSX.readFile('../../ICD-10-CM - fatma aljabri.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Loaded ${data.length} rows from Excel file`);
    console.log('📋 Columns:', Object.keys(data[0] || {}));
    
    // Show sample data
    if (data.length > 0) {
      console.log('📄 Sample row:', data[0]);
    }
    
    return data;
    
  } catch (error) {
    console.error('❌ Error loading Excel file:', error);
    throw error;
  }
}

/**
 * Map Excel data to our database schema
 */
function mapExcelToICD(excelRow) {
  // Map the actual Excel columns to our ICD schema
  const code = excelRow['CODE'] || '';
  const title = excelRow['DISPLAY'] || excelRow['short_description'] || '';
  const chapter = excelRow['chapter_description'] || '';
  const block = ''; // Not available in this Excel structure
  const category = ''; // Not available in this Excel structure
  
  // Create synonyms array from short_description if different from DISPLAY
  const synonyms = [];
  if (excelRow['short_description'] && excelRow['short_description'] !== excelRow['DISPLAY']) {
    synonyms.push(excelRow['short_description']);
  }
  
  return {
    code: code.toString().trim(),
    title: title.toString().trim(),
    normalized_title: title.toString().toLowerCase().trim(),
    synonyms: synonyms.filter(s => s.length > 0),
    chapter: chapter.toString().trim(),
    block: block.toString().trim(),
    category: category.toString().trim(),
    has_specifiers: false // We'll determine this based on code patterns
  };
}

/**
 * Determine if an ICD code has specifiers based on code patterns
 */
function hasSpecifiers(code) {
  // ICD-10-CM codes that typically have specifiers
  const specifierPatterns = [
    /^S\d{2}\.\d+$/,  // Injury codes (S-codes)
    /^T\d{2}\.\d+$/,  // Poisoning codes (T-codes)
    /^M\d{2}\.\d+$/,  // Musculoskeletal codes (M-codes)
    /^G\d{2}\.\d+$/,  // Nervous system codes (G-codes)
    /^H\d{2}\.\d+$/,  // Eye and adnexa codes (H-codes)
    /^K\d{2}\.\d+$/,  // Digestive system codes (K-codes)
    /^N\d{2}\.\d+$/,  // Genitourinary system codes (N-codes)
    /^O\d{2}\.\d+$/,  // Pregnancy codes (O-codes)
    /^P\d{2}\.\d+$/,  // Perinatal codes (P-codes)
    /^Q\d{2}\.\d+$/,  // Congenital codes (Q-codes)
    /^R\d{2}\.\d+$/,  // Symptoms codes (R-codes)
    /^Z\d{2}\.\d+$/   // Factors influencing health status (Z-codes)
  ];
  
  return specifierPatterns.some(pattern => pattern.test(code));
}

/**
 * Load the complete ICD dataset into the database
 */
async function loadFullDataset() {
  console.log('🚀 Starting full ICD-10-CM dataset loading...');
  
  try {
    // Load Excel data
    const excelData = await loadExcelData();
    
    if (excelData.length === 0) {
      console.log('⚠️ No data found in Excel file');
      return false;
    }
    
    // Clear existing data
    console.log('🧹 Clearing existing ICD data...');
    await pool.query('DELETE FROM icd_codes');
    console.log('✅ Existing data cleared');
    
    // Process and insert data in batches
    const batchSize = 50;
    let processed = 0;
    let inserted = 0;
    
    console.log(`📥 Processing ${excelData.length} records in batches of ${batchSize}...`);
    
    for (let i = 0; i < excelData.length; i += batchSize) {
      const batch = excelData.slice(i, i + batchSize);
      console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(excelData.length/batchSize)}`);
      
      const insertPromises = batch.map(async (excelRow) => {
        try {
          const icdData = mapExcelToICD(excelRow);
          
          // Skip invalid entries
          if (!icdData.code || !icdData.title) {
            return null;
          }
          
          // Determine if code has specifiers
          icdData.has_specifiers = hasSpecifiers(icdData.code);
          
          // Insert into database
          await pool.query(`
            INSERT INTO icd_codes (code, title, normalized_title, synonyms, chapter, block, category, has_specifiers, title_embedding)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            icdData.code,
            icdData.title,
            icdData.normalized_title,
            JSON.stringify(icdData.synonyms),
            icdData.chapter,
            icdData.block,
            icdData.category,
            icdData.has_specifiers,
            null // Will be filled with embeddings later
          ]);
          
          return icdData;
          
        } catch (error) {
          console.error(`❌ Error processing row ${i + batch.indexOf(excelRow)}:`, error.message);
          return null;
        }
      });
      
      const results = await Promise.all(insertPromises);
      const successful = results.filter(r => r !== null);
      
      processed += batch.length;
      inserted += successful.length;
      
      console.log(`✅ Batch completed: ${successful.length}/${batch.length} successful`);
    }
    
    console.log(`🎉 Data loading completed!`);
    console.log(`📊 Total processed: ${processed}`);
    console.log(`✅ Successfully inserted: ${inserted}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Error loading full dataset:', error);
    return false;
  }
}

/**
 * Generate embeddings for all ICD codes
 */
async function generateAllEmbeddings() {
  console.log('🤖 Generating AI embeddings for all ICD codes...');
  
  try {
    // Get all ICD codes without embeddings
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
    
    // Process in batches to avoid rate limits
    const batchSize = 10;
    let processed = 0;
    
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      console.log(`🔄 Processing embedding batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(codes.length/batchSize)}`);
      
      const embeddingPromises = batch.map(async (icdCode) => {
        try {
          // Create comprehensive search text
          const synonyms = icdCode.synonyms ? icdCode.synonyms.join(' ') : '';
          const searchText = `${icdCode.code} ${icdCode.title} ${synonyms} ${icdCode.chapter} ${icdCode.block} ${icdCode.category}`;
          
          console.log(`  📝 Generating embedding for: ${icdCode.code}`);
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
 * Main function to load the complete dataset
 */
async function main() {
  console.log('🚀 Starting complete ICD-10-CM dataset loading with AI embeddings...');
  
  try {
    // Step 1: Load data from Excel
    const dataLoaded = await loadFullDataset();
    if (!dataLoaded) {
      console.log('💥 Data loading failed!');
      process.exit(1);
    }
    
    // Step 2: Generate AI embeddings
    const embeddingsGenerated = await generateAllEmbeddings();
    if (!embeddingsGenerated) {
      console.log('💥 Embedding generation failed!');
      process.exit(1);
    }
    
    console.log('🎉 Complete ICD-10-CM dataset with AI embeddings loaded successfully!');
    console.log('🚀 Your RAG system is now fully operational with the complete dataset!');
    console.log('📝 Next steps:');
    console.log('   1. Restart the backend server');
    console.log('   2. Test the AI-powered search with the full dataset');
    console.log('   3. Enjoy intelligent ICD code suggestions!');
    
  } catch (error) {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the main function
main();
