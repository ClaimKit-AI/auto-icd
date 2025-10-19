// Smart Hospital Code Importer
// Imports ICD/CPT codes from Excel, skips duplicates, embeds while storing
// Uses parallel processing for maximum speed

import XLSX from 'xlsx'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { query } from './src/database.js' // Use existing database connection

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment
dotenv.config()

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

/**
 * SMART IMPORT ALGORITHM
 * 
 * 1. Read Excel file (auto-detect structure)
 * 2. Query existing codes in ONE query (fast!)
 * 3. Filter out duplicates (in-memory, instant)
 * 4. Insert new codes in batches
 * 5. Generate embeddings in parallel (10 workers)
 * 6. Update codes with embeddings in batches
 * 
 * Speed: ~20-30 codes/second with embeddings
 */

class HospitalCodeImporter {
  constructor(excelPath) {
    this.excelPath = excelPath
    this.stats = {
      total: 0,
      duplicates: 0,
      imported: 0,
      embedded: 0,
      errors: 0,
      startTime: Date.now()
    }
  }
  
  /**
   * Main import function
   */
  async import() {
    console.log('📊 Smart Hospital Code Importer')
    console.log('=' .repeat(60))
    
    // Step 1: Read and detect structure
    const codes = await this.readExcel()
    console.log(`\n✅ Read ${codes.icd.length} ICD + ${codes.cpt.length} CPT codes from Excel`)
    
    this.stats.total = codes.icd.length + codes.cpt.length
    
    // Step 2: Import ICD codes
    if (codes.icd.length > 0) {
      await this.importICD(codes.icd)
    }
    
    // Step 3: Import CPT codes
    if (codes.cpt.length > 0) {
      await this.importCPT(codes.cpt)
    }
    
    // Print summary
    this.printSummary()
  }
  
  /**
   * Read Excel and auto-detect structure
   */
  async readExcel() {
    console.log(`\n📖 Reading Excel file: ${this.excelPath}`)
    
    const workbook = XLSX.readFile(this.excelPath)
    console.log(`   Found ${workbook.SheetNames.length} sheets:`, workbook.SheetNames)
    
    const icdCodes = []
    const cptCodes = []
    
    // Process each sheet
    for (const sheetName of workbook.SheetNames) {
      console.log(`\n   📄 Processing sheet: "${sheetName}"`)
      
      const sheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(sheet)
      
      if (data.length === 0) {
        console.log(`      ⚠️  Empty sheet, skipping`)
        continue
      }
      
      console.log(`      Found ${data.length} rows`)
      
      // Auto-detect if this is ICD or CPT
      const firstRow = data[0]
      const columns = Object.keys(firstRow)
      console.log(`      Columns:`, columns.slice(0, 5).join(', '))
      
      // Detect code column
      const codeColumn = this.detectCodeColumn(columns, data[0])
      const descColumn = this.detectDescriptionColumn(columns)
      
      console.log(`      Detected code column: "${codeColumn}"`)
      console.log(`      Detected description column: "${descColumn}"`)
      
      // Process rows
      for (const row of data) {
        const code = String(row[codeColumn] || '').trim()
        const description = String(row[descColumn] || '').trim()
        
        if (!code || code.length < 3) continue
        
        // Determine if ICD or CPT by code pattern
        if (this.isICDCode(code)) {
          icdCodes.push({
            code: code,
            title: description || code,
            source: sheetName
          })
        } else if (this.isCPTCode(code)) {
          // Get both DISPLAY and short_description from Excel
          const display = String(row['DISPLAY'] || row['display'] || description || code).trim()
          const shortDesc = String(row['short_description'] || description || code).trim()
          
          cptCodes.push({
            code: code,
            display: display, // Required column
            short_description: shortDesc,
            source: sheetName
          })
        }
      }
    }
    
    return { icd: icdCodes, cpt: cptCodes }
  }
  
  /**
   * Detect code column (smart detection)
   */
  detectCodeColumn(columns, firstRow) {
    // Common column names for codes
    const codePatterns = ['code', 'icd', 'cpt', 'diagnosis', 'procedure']
    
    for (const col of columns) {
      if (codePatterns.some(p => col.toLowerCase().includes(p))) {
        return col
      }
    }
    
    // Fallback: first column that looks like a code
    for (const col of columns) {
      const value = String(firstRow[col] || '').trim()
      if (value.match(/^[A-Z0-9.]+$/)) {
        return col
      }
    }
    
    return columns[0]
  }
  
  /**
   * Detect description column
   */
  detectDescriptionColumn(columns) {
    const descPatterns = ['description', 'title', 'name', 'desc', 'label']
    
    for (const col of columns) {
      if (descPatterns.some(p => col.toLowerCase().includes(p))) {
        return col
      }
    }
    
    return columns[1] || columns[0]
  }
  
  /**
   * Check if code is ICD format
   */
  isICDCode(code) {
    // ICD-10: Letter + 2-3 digits + optional decimal + digits
    return code.match(/^[A-Z][0-9]{2,3}\.?[0-9]*$/)
  }
  
  /**
   * Check if code is CPT format
   */
  isCPTCode(code) {
    // CPT: 5 digits or 4 digits + letter
    return code.match(/^[0-9]{4,5}[A-Z]?$/)
  }
  
  /**
   * Import ICD codes (skip duplicates, embed new ones)
   */
  async importICD(icdCodes) {
    console.log(`\n🏥 Importing ${icdCodes.length} ICD codes...`)
    
    // Get ALL existing ICD codes in ONE query (fast!)
    console.log('   🔍 Checking for duplicates...')
    const result = await query('SELECT code FROM icd_codes')
    
    const existingCodes = new Set(result.rows.map(r => r.code))
    console.log(`   Found ${existingCodes.size} existing ICD codes in database`)
    
    // Filter new codes (in-memory, instant!)
    const newCodes = icdCodes.filter(c => !existingCodes.has(c.code))
    
    console.log(`   ✅ ${newCodes.length} new codes to import`)
    console.log(`   ⏭️  ${icdCodes.length - newCodes.length} duplicates skipped`)
    
    this.stats.duplicates += (icdCodes.length - newCodes.length)
    
    if (newCodes.length === 0) {
      console.log('   ℹ️  No new codes to import')
      return
    }
    
    // Insert new codes in batches (without embeddings first - fast!)
    console.log(`\n   📝 Inserting ${newCodes.length} new codes...`)
    const batchSize = 100
    
    for (let i = 0; i < newCodes.length; i += batchSize) {
      const batch = newCodes.slice(i, i + batchSize)
      
      try {
        // Build multi-row INSERT
        const values = batch.map((c, idx) => 
          `($${idx*2+1}, $${idx*2+2})`
        ).join(', ')
        
        const params = batch.flatMap(c => [c.code, c.title])
        
        await query(`
          INSERT INTO icd_codes (code, title)
          VALUES ${values}
          ON CONFLICT (code) DO NOTHING
        `, params)
        
        this.stats.imported += batch.length
        console.log(`   ✅ Inserted ${i + batch.length}/${newCodes.length}`)
      } catch (error) {
        console.error(`   ❌ Batch error:`, error.message)
        this.stats.errors += batch.length
      }
    }
    
    // Generate embeddings in parallel (FAST!)
    console.log(`\n   🧠 Generating embeddings for ${newCodes.length} new codes...`)
    await this.generateEmbeddingsParallel(newCodes, 'icd')
  }
  
  /**
   * Import CPT codes (same pattern)
   */
  async importCPT(cptCodes) {
    console.log(`\n💊 Importing ${cptCodes.length} CPT codes...`)
    
    // Check duplicates
    console.log('   🔍 Checking for duplicates...')
    const result = await query('SELECT code FROM cpt_codes')
    
    const existingCodes = new Set(result.rows.map(r => r.code))
    console.log(`   Found ${existingCodes.size} existing CPT codes`)
    
    const newCodes = cptCodes.filter(c => !existingCodes.has(c.code))
    
    console.log(`   ✅ ${newCodes.length} new codes to import`)
    console.log(`   ⏭️  ${cptCodes.length - newCodes.length} duplicates skipped`)
    
    this.stats.duplicates += (cptCodes.length - newCodes.length)
    
    if (newCodes.length === 0) {
      console.log('   ℹ️  No new codes to import')
      return
    }
    
    // Insert new codes
    console.log(`\n   📝 Inserting ${newCodes.length} new codes...`)
    const batchSize = 100
    
    for (let i = 0; i < newCodes.length; i += batchSize) {
      const batch = newCodes.slice(i, i + batchSize)
      
      try {
        const values = batch.map((c, idx) => 
          `($${idx*3+1}, $${idx*3+2}, $${idx*3+3})`
        ).join(', ')
        
        const params = batch.flatMap(c => [c.code, c.display, c.short_description])
        
        await query(`
          INSERT INTO cpt_codes (code, display, short_description)
          VALUES ${values}
          ON CONFLICT (code) DO NOTHING
        `, params)
        
        this.stats.imported += batch.length
        console.log(`   ✅ Inserted ${i + batch.length}/${newCodes.length}`)
      } catch (error) {
        console.error(`   ❌ Batch error:`, error.message)
        this.stats.errors += batch.length
      }
    }
    
    // Generate embeddings
    console.log(`\n   🧠 Generating embeddings for ${newCodes.length} new codes...`)
    await this.generateEmbeddingsParallel(newCodes, 'cpt')
  }
  
  /**
   * Generate embeddings in parallel (FAST - reuses parallel-embedding-generator logic)
   */
  async generateEmbeddingsParallel(codes, type) {
    const workers = 3 // Reduced to avoid overwhelming DB connection pool
    const batchSize = 20 // Smaller batches for stability
    const queue = [...codes]
    let processed = 0
    const startTime = Date.now()
    
    // Worker function
    const processCode = async (code) => {
      try {
        const text = type === 'icd' ? code.title : code.short_description
        
        // Generate embedding
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text
        })
        
        const embedding = response.data[0].embedding
        
        // Update database
        const table = type === 'icd' ? 'icd_codes' : 'cpt_codes'
        const embeddingColumn = type === 'icd' ? 'title_embedding' : 'display_embedding'
        
        try {
          await query(`
            UPDATE ${table}
            SET ${embeddingColumn} = $1
            WHERE code = $2
          `, [JSON.stringify(embedding), code.code])
          
          
          processed++
          this.stats.embedded++
          
          // Progress update
          if (processed % 10 === 0 || processed === codes.length) {
            const elapsed = (Date.now() - startTime) / 1000
            const rate = processed / elapsed
            const remaining = codes.length - processed
            const eta = remaining / rate
            
            console.log(`      [${type.toUpperCase()}] ${processed}/${codes.length} (${((processed/codes.length)*100).toFixed(1)}%) | Rate: ${rate.toFixed(1)}/s | ETA: ${Math.ceil(eta)}s`)
          }
          
          return { success: true, code: code.code }
        } catch (updateErr) {
          console.error(`      ❌ Update failed for ${code.code}:`, updateErr.message)
          this.stats.errors++
          return { success: false, code: code.code, error: updateErr.message }
        }
      } catch (err) {
        console.error(`      ❌ ${code.code}:`, err.message)
        this.stats.errors++
        return { success: false, code: code.code, error: err.message }
      }
    }
    
    // Run workers in parallel
    const workerPromises = []
    for (let i = 0; i < workers; i++) {
      workerPromises.push((async () => {
        while (queue.length > 0) {
          const batch = queue.splice(0, batchSize)
          await Promise.all(batch.map(processCode))
        }
      })())
    }
    
    await Promise.all(workerPromises)
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`   ✅ Generated ${this.stats.embedded} embeddings in ${duration}s`)
  }
  
  /**
   * Print summary
   */
  printSummary() {
    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(1)
    
    console.log('\n' + '='.repeat(60))
    console.log('📊 IMPORT SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total codes in file:    ${this.stats.total}`)
    console.log(`Duplicates skipped:     ${this.stats.duplicates}`)
    console.log(`New codes imported:     ${this.stats.imported}`)
    console.log(`Embeddings generated:   ${this.stats.embedded}`)
    console.log(`Errors:                 ${this.stats.errors}`)
    console.log(`Total time:             ${duration}s`)
    console.log(`Import rate:            ${(this.stats.imported / parseFloat(duration)).toFixed(1)} codes/s`)
    console.log('='.repeat(60))
    
    if (this.stats.errors > 0) {
      console.log(`\n⚠️  ${this.stats.errors} errors occurred. Check logs above.`)
    } else {
      console.log('\n✅ Import completed successfully!')
    }
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

const run = async () => {
  const args = process.argv.slice(2)
  
  if (args.length === 0) {
    console.log(`
Usage: node import-hospital-codes.js <excel-file>

Example:
  node import-hospital-codes.js ../../CPT.xlsx
  node import-hospital-codes.js /path/to/hospital-codes.xlsx

Features:
✅ Auto-detects Excel structure
✅ Skips duplicates automatically
✅ Generates embeddings while importing
✅ Parallel processing (10 workers)
✅ 20-30 codes/second with embeddings

The script will:
1. Read Excel file (all sheets)
2. Auto-detect ICD vs CPT codes
3. Check existing codes (skip duplicates)
4. Insert new codes only
5. Generate embeddings in parallel
6. Print detailed summary
    `)
    process.exit(0)
  }
  
  const excelPath = path.resolve(args[0])
  
  console.log('\n🚀 Starting smart import...')
  console.log(`   File: ${excelPath}`)
  
  const importer = new HospitalCodeImporter(excelPath)
  await importer.import()
}

run().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})

