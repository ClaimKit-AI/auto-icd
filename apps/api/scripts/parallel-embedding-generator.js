// Parallel Embedding Generator for Auto-ICD Upgrade
// Generates missing embeddings with 10x speedup using concurrent workers
//
// Usage:
//   node scripts/parallel-embedding-generator.js --dry-run
//   node scripts/parallel-embedding-generator.js --icd --workers 10
//   node scripts/parallel-embedding-generator.js --cpt --batch-size 100
//   node scripts/parallel-embedding-generator.js --icd --cpt --resume

import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

// Configuration
const CONFIG = {
  workers: parseInt(process.argv.find(arg => arg.startsWith('--workers='))?.split('=')[1]) || 10,
  batchSize: parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1]) || 100,
  dryRun: process.argv.includes('--dry-run'),
  generateICD: process.argv.includes('--icd'),
  generateCPT: process.argv.includes('--cpt'),
  resume: process.argv.includes('--resume'),
  checkpointInterval: 100, // Save progress every 100 items
  maxRetries: 3,
  retryDelay: 2000,
  model: 'text-embedding-3-small',
  dimensions: 1536
};

// If no type specified, generate both
if (!CONFIG.generateICD && !CONFIG.generateCPT) {
  CONFIG.generateICD = true;
  CONFIG.generateCPT = true;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: CONFIG.workers + 5 // Extra connections for queries
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Checkpoint file paths
const ICD_CHECKPOINT = join(__dirname, '../.checkpoint-icd.json');
const CPT_CHECKPOINT = join(__dirname, '../.checkpoint-cpt.json');

// Statistics
const stats = {
  icd: {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    cost: 0
  },
  cpt: {
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    cost: 0
  },
  startTime: null,
  errors: []
};

// Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(title) {
  log('\n' + '='.repeat(70), colors.cyan);
  log(`  ${title}`, colors.bright + colors.cyan);
  log('='.repeat(70), colors.cyan);
}

// Load checkpoint
function loadCheckpoint(type) {
  const checkpointFile = type === 'icd' ? ICD_CHECKPOINT : CPT_CHECKPOINT;
  try {
    if (fs.existsSync(checkpointFile)) {
      const data = JSON.parse(fs.readFileSync(checkpointFile, 'utf-8'));
      log(`📂 Loaded checkpoint: ${data.processedCodes.length} codes already processed`, colors.green);
      return data;
    }
  } catch (error) {
    log(`⚠️  Could not load checkpoint: ${error.message}`, colors.yellow);
  }
  return { processedCodes: [], timestamp: new Date().toISOString() };
}

// Save checkpoint
function saveCheckpoint(type, processedCodes) {
  const checkpointFile = type === 'icd' ? ICD_CHECKPOINT : CPT_CHECKPOINT;
  try {
    fs.writeFileSync(checkpointFile, JSON.stringify({
      processedCodes: processedCodes,
      timestamp: new Date().toISOString()
    }, null, 2));
  } catch (error) {
    log(`⚠️  Could not save checkpoint: ${error.message}`, colors.yellow);
  }
}

// Generate embedding with retry logic
async function generateEmbeddingWithRetry(text, retries = CONFIG.maxRetries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.embeddings.create({
        model: CONFIG.model,
        input: text,
        encoding_format: 'float'
      });
      return response.data[0].embedding;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff
      const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1);
      log(`  ⚠️  Attempt ${attempt} failed, retrying in ${delay}ms...`, colors.yellow);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Worker function
async function worker(id, queue, type, processedCodes) {
  const workerStats = { processed: 0, failed: 0 };
  
  while (queue.length > 0) {
    const item = queue.shift();
    if (!item) break;
    
    try {
      // Check if already processed (from checkpoint)
      if (processedCodes.has(item.code)) {
        stats[type].skipped++;
        continue;
      }
      
      // Generate search text
      let searchText;
      if (type === 'icd') {
        const synonyms = item.synonyms ? JSON.parse(item.synonyms).join(' ') : '';
        searchText = `${item.code} ${item.title} ${synonyms} ${item.chapter || ''}`;
      } else {
        searchText = `${item.code} ${item.display} ${item.short_description || ''}`;
      }
      
      // Generate embedding
      const embedding = await generateEmbeddingWithRetry(searchText);
      
      // Store in database (unless dry-run)
      if (!CONFIG.dryRun) {
        if (type === 'icd') {
          await pool.query(
            'UPDATE icd_codes SET title_embedding = $1 WHERE code = $2',
            [JSON.stringify(embedding), item.code]
          );
        } else {
          await pool.query(
            'UPDATE cpt_codes SET display_embedding = $1 WHERE code = $2',
            [JSON.stringify(embedding), item.code]
          );
        }
      }
      
      processedCodes.add(item.code);
      stats[type].successful++;
      workerStats.processed++;
      
      // Calculate cost (text-embedding-3-small: $0.00002 per 1K tokens, ~1 token per 4 chars)
      const estimatedTokens = searchText.length / 4;
      stats[type].cost += (estimatedTokens / 1000) * 0.00002;
      
    } catch (error) {
      stats[type].failed++;
      workerStats.failed++;
      stats.errors.push({
        code: item.code,
        type,
        error: error.message
      });
      log(`  ❌ Worker ${id}: Failed ${item.code} - ${error.message}`, colors.red);
    }
    
    stats[type].processed++;
    
    // Save checkpoint every N items
    if (stats[type].processed % CONFIG.checkpointInterval === 0) {
      saveCheckpoint(type, Array.from(processedCodes));
    }
    
    // Progress update
    if (stats[type].processed % 10 === 0) {
      printProgress(type);
    }
  }
  
  return workerStats;
}

// Print progress
function printProgress(type) {
  const s = stats[type];
  const elapsed = (Date.now() - stats.startTime) / 1000;
  const rate = s.processed / elapsed;
  const remaining = s.total - s.processed;
  const eta = remaining / rate;
  
  const percentage = ((s.processed / s.total) * 100).toFixed(1);
  
  log(`  [${type.toUpperCase()}] ${s.processed}/${s.total} (${percentage}%) | ` +
      `✓ ${s.successful} | ✗ ${s.failed} | ` +
      `Rate: ${rate.toFixed(1)}/s | ETA: ${formatTime(eta)}`, 
      colors.cyan);
}

// Format time
function formatTime(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Generate embeddings for ICD codes
async function generateICDEmbeddings() {
  logHeader('GENERATING ICD EMBEDDINGS');
  
  // Load checkpoint
  const checkpoint = CONFIG.resume ? loadCheckpoint('icd') : { processedCodes: [] };
  const processedCodes = new Set(checkpoint.processedCodes);
  
  // Get codes without embeddings
  const result = await pool.query(`
    SELECT code, title, synonyms, chapter
    FROM icd_codes
    WHERE title_embedding IS NULL
    ORDER BY code
  `);
  
  const codes = result.rows;
  stats.icd.total = codes.length;
  
  log(`\n📊 Found ${codes.length} ICD codes without embeddings`, colors.cyan);
  log(`📂 Checkpoint: ${processedCodes.size} codes already processed`, colors.cyan);
  log(`⚙️  Workers: ${CONFIG.workers}`, colors.cyan);
  log(`📦 Batch Size: ${CONFIG.batchSize}`, colors.cyan);
  log(`💰 Estimated Cost: $${(codes.length * 0.00002).toFixed(2)}`, colors.cyan);
  log(`⏱️  Estimated Time: ~${Math.ceil(codes.length / (CONFIG.workers * 10))} minutes\n`, colors.cyan);
  
  if (CONFIG.dryRun) {
    log('🔍 DRY RUN MODE - No embeddings will be generated\n', colors.yellow);
    return;
  }
  
  if (codes.length === 0) {
    log('✅ All ICD codes already have embeddings!\n', colors.green);
    return;
  }
  
  // Create work queue
  const queue = [...codes];
  
  // Start workers
  stats.startTime = Date.now();
  const workers = [];
  
  for (let i = 0; i < CONFIG.workers; i++) {
    workers.push(worker(i + 1, queue, 'icd', processedCodes));
  }
  
  // Wait for all workers to complete
  await Promise.all(workers);
  
  // Final progress
  printProgress('icd');
  
  // Save final checkpoint
  saveCheckpoint('icd', Array.from(processedCodes));
  
  log(`\n✅ ICD Embedding Generation Complete!`, colors.green);
  log(`   Successful: ${stats.icd.successful}`, colors.green);
  log(`   Failed: ${stats.icd.failed}`, colors.red);
  log(`   Skipped: ${stats.icd.skipped}`, colors.yellow);
  log(`   Total Cost: $${stats.icd.cost.toFixed(4)}`, colors.cyan);
}

// Generate embeddings for CPT codes
async function generateCPTEmbeddings() {
  logHeader('GENERATING CPT EMBEDDINGS');
  
  // Load checkpoint
  const checkpoint = CONFIG.resume ? loadCheckpoint('cpt') : { processedCodes: [] };
  const processedCodes = new Set(checkpoint.processedCodes);
  
  // Get codes without embeddings
  const result = await pool.query(`
    SELECT code, display, short_description
    FROM cpt_codes
    WHERE display_embedding IS NULL
    AND active = true
    ORDER BY code
  `);
  
  const codes = result.rows;
  stats.cpt.total = codes.length;
  
  log(`\n📊 Found ${codes.length} CPT codes without embeddings`, colors.cyan);
  log(`📂 Checkpoint: ${processedCodes.size} codes already processed`, colors.cyan);
  log(`⚙️  Workers: ${CONFIG.workers}`, colors.cyan);
  log(`📦 Batch Size: ${CONFIG.batchSize}`, colors.cyan);
  log(`💰 Estimated Cost: $${(codes.length * 0.00002).toFixed(2)}`, colors.cyan);
  log(`⏱️  Estimated Time: ~${Math.ceil(codes.length / (CONFIG.workers * 10))} minutes\n`, colors.cyan);
  
  if (CONFIG.dryRun) {
    log('🔍 DRY RUN MODE - No embeddings will be generated\n', colors.yellow);
    return;
  }
  
  if (codes.length === 0) {
    log('✅ All CPT codes already have embeddings!\n', colors.green);
    return;
  }
  
  // Create work queue
  const queue = [...codes];
  
  // Start workers
  if (!stats.startTime) stats.startTime = Date.now();
  const workers = [];
  
  for (let i = 0; i < CONFIG.workers; i++) {
    workers.push(worker(i + 1, queue, 'cpt', processedCodes));
  }
  
  // Wait for all workers to complete
  await Promise.all(workers);
  
  // Final progress
  printProgress('cpt');
  
  // Save final checkpoint
  saveCheckpoint('cpt', Array.from(processedCodes));
  
  log(`\n✅ CPT Embedding Generation Complete!`, colors.green);
  log(`   Successful: ${stats.cpt.successful}`, colors.green);
  log(`   Failed: ${stats.cpt.failed}`, colors.red);
  log(`   Skipped: ${stats.cpt.skipped}`, colors.yellow);
  log(`   Total Cost: $${stats.cpt.cost.toFixed(4)}`, colors.cyan);
}

// Main function
async function main() {
  logHeader('PARALLEL EMBEDDING GENERATOR v2.0');
  
  log(`\n⚙️  Configuration:`, colors.cyan);
  log(`   Workers: ${CONFIG.workers}`, colors.cyan);
  log(`   Batch Size: ${CONFIG.batchSize}`, colors.cyan);
  log(`   Model: ${CONFIG.model}`, colors.cyan);
  log(`   Dry Run: ${CONFIG.dryRun}`, colors.cyan);
  log(`   Generate ICD: ${CONFIG.generateICD}`, colors.cyan);
  log(`   Generate CPT: ${CONFIG.generateCPT}`, colors.cyan);
  log(`   Resume: ${CONFIG.resume}`, colors.cyan);
  
  try {
    if (CONFIG.generateICD) {
      await generateICDEmbeddings();
    }
    
    if (CONFIG.generateCPT) {
      await generateCPTEmbeddings();
    }
    
    // Final summary
    logHeader('FINAL SUMMARY');
    
    if (CONFIG.generateICD) {
      log(`\nICD Codes:`, colors.bright);
      log(`  Processed: ${stats.icd.processed}`, colors.cyan);
      log(`  Successful: ${stats.icd.successful}`, colors.green);
      log(`  Failed: ${stats.icd.failed}`, stats.icd.failed > 0 ? colors.red : colors.green);
      log(`  Cost: $${stats.icd.cost.toFixed(4)}`, colors.cyan);
    }
    
    if (CONFIG.generateCPT) {
      log(`\nCPT Codes:`, colors.bright);
      log(`  Processed: ${stats.cpt.processed}`, colors.cyan);
      log(`  Successful: ${stats.cpt.successful}`, colors.green);
      log(`  Failed: ${stats.cpt.failed}`, stats.cpt.failed > 0 ? colors.red : colors.green);
      log(`  Cost: $${stats.cpt.cost.toFixed(4)}`, colors.cyan);
    }
    
    const totalCost = stats.icd.cost + stats.cpt.cost;
    const totalTime = (Date.now() - stats.startTime) / 1000;
    
    log(`\nTotal:`, colors.bright);
    log(`  Time: ${formatTime(totalTime)}`, colors.cyan);
    log(`  Cost: $${totalCost.toFixed(4)}`, colors.cyan);
    
    if (stats.errors.length > 0) {
      log(`\n⚠️  ${stats.errors.length} errors occurred:`, colors.yellow);
      stats.errors.slice(0, 10).forEach(err => {
        log(`   ${err.type.toUpperCase()} ${err.code}: ${err.error}`, colors.yellow);
      });
      
      if (stats.errors.length > 10) {
        log(`   ... and ${stats.errors.length - 10} more`, colors.yellow);
      }
    }
    
    log(`\n✅ Generation complete!`, colors.green);
    
    if (!CONFIG.dryRun) {
      log(`\n📝 Next steps:`, colors.cyan);
      log(`   1. Run: node scripts/diagnose-database.js`, colors.cyan);
      log(`   2. Verify coverage is now >= 95%`, colors.cyan);
      log(`   3. Continue to Phase 1.3: Data Integrity Validation`, colors.cyan);
    }
    
  } catch (error) {
    log(`\n❌ Fatal error: ${error.message}`, colors.red);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run main function
main().catch(console.error);

