// Database Diagnostic Tool for Auto-ICD Upgrade
// This script assesses the current state of the database before Phase 1 upgrades
//
// Usage: node scripts/diagnose-database.js

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function print(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader(title) {
  print('\n' + '='.repeat(70), colors.cyan);
  print(`  ${title}`, colors.bright + colors.cyan);
  print('='.repeat(70), colors.cyan);
}

function printSection(title) {
  print(`\n${title}`, colors.bright + colors.blue);
  print('-'.repeat(title.length), colors.blue);
}

// Main diagnostic function
async function runDiagnostics() {
  print('\n🔍 Auto-ICD Database Diagnostic Tool', colors.bright);
  print('Starting comprehensive database assessment...', colors.cyan);
  
  const results = {
    icd: {},
    cpt: {},
    links: {},
    specifiers: {},
    issues: [],
    warnings: [],
    score: 0
  };
  
  try {
    // 1. ICD Codes Assessment
    printHeader('1. ICD CODES ASSESSMENT');
    
    const icdTotal = await pool.query('SELECT COUNT(*) as count FROM icd_codes');
    const icdWithEmbeddings = await pool.query('SELECT COUNT(*) as count FROM icd_codes WHERE title_embedding IS NOT NULL');
    const icdActive = await pool.query('SELECT COUNT(*) as count FROM icd_codes WHERE has_specifiers = true');
    
    results.icd.total = parseInt(icdTotal.rows[0].count);
    results.icd.withEmbeddings = parseInt(icdWithEmbeddings.rows[0].count);
    results.icd.withoutEmbeddings = results.icd.total - results.icd.withEmbeddings;
    results.icd.coverage = (results.icd.withEmbeddings / results.icd.total * 100).toFixed(2);
    results.icd.withSpecifiers = parseInt(icdActive.rows[0].count);
    
    print(`Total ICD Codes: ${results.icd.total}`, colors.cyan);
    print(`With Embeddings: ${results.icd.withEmbeddings} (${results.icd.coverage}%)`, 
          results.icd.coverage >= 95 ? colors.green : colors.yellow);
    print(`Without Embeddings: ${results.icd.withoutEmbeddings}`, 
          results.icd.withoutEmbeddings === 0 ? colors.green : colors.red);
    print(`With Specifiers: ${results.icd.withSpecifiers}`, colors.cyan);
    
    if (results.icd.coverage < 95) {
      results.issues.push(`Only ${results.icd.coverage}% of ICD codes have embeddings (target: 95%+)`);
    }
    
    // Sample check: embedding dimensions
    const sampleEmbedding = await pool.query(`
      SELECT title_embedding 
      FROM icd_codes 
      WHERE title_embedding IS NOT NULL 
      LIMIT 1
    `);
    
    if (sampleEmbedding.rows.length > 0) {
      const embedding = JSON.parse(sampleEmbedding.rows[0].title_embedding);
      print(`Embedding Dimensions: ${embedding.length}`, 
            embedding.length === 1536 ? colors.green : colors.red);
      
      if (embedding.length !== 1536) {
        results.issues.push(`ICD embeddings have wrong dimensions: ${embedding.length} (expected: 1536)`);
      }
    }
    
    // 2. CPT Codes Assessment
    printHeader('2. CPT CODES ASSESSMENT');
    
    const cptTotal = await pool.query('SELECT COUNT(*) as count FROM cpt_codes');
    const cptActive = await pool.query('SELECT COUNT(*) as count FROM cpt_codes WHERE active = true');
    const cptWithEmbeddings = await pool.query('SELECT COUNT(*) as count FROM cpt_codes WHERE display_embedding IS NOT NULL AND active = true');
    
    results.cpt.total = parseInt(cptTotal.rows[0].count);
    results.cpt.active = parseInt(cptActive.rows[0].count);
    results.cpt.withEmbeddings = parseInt(cptWithEmbeddings.rows[0].count);
    results.cpt.withoutEmbeddings = results.cpt.active - results.cpt.withEmbeddings;
    results.cpt.coverage = (results.cpt.withEmbeddings / results.cpt.active * 100).toFixed(2);
    
    print(`Total CPT Codes: ${results.cpt.total}`, colors.cyan);
    print(`Active CPT Codes: ${results.cpt.active}`, colors.cyan);
    print(`With Embeddings: ${results.cpt.withEmbeddings} (${results.cpt.coverage}%)`, 
          results.cpt.coverage >= 95 ? colors.green : colors.yellow);
    print(`Without Embeddings: ${results.cpt.withoutEmbeddings}`, 
          results.cpt.withoutEmbeddings === 0 ? colors.green : colors.red);
    
    if (results.cpt.coverage < 95) {
      results.issues.push(`Only ${results.cpt.coverage}% of active CPT codes have embeddings (target: 95%+)`);
    }
    
    // CPT by Chapter
    const cptByChapter = await pool.query(`
      SELECT chapter, 
             COUNT(*) as total,
             COUNT(display_embedding) as with_embeddings,
             ROUND((COUNT(display_embedding)::numeric / COUNT(*) * 100), 1) as percentage
      FROM cpt_codes
      WHERE active = true
      GROUP BY chapter
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    
    printSection('Top CPT Chapters');
    cptByChapter.rows.forEach(row => {
      const pct = parseFloat(row.percentage);
      print(`  ${row.chapter}: ${row.with_embeddings}/${row.total} (${row.percentage}%)`, 
            pct >= 95 ? colors.green : pct >= 50 ? colors.yellow : colors.red);
    });
    
    // 3. ICD-CPT Links Assessment
    printHeader('3. ICD-CPT LINKS ASSESSMENT');
    
    const linksTotal = await pool.query('SELECT COUNT(*) as count FROM icd_cpt_links');
    results.links.total = parseInt(linksTotal.rows[0].count);
    
    print(`Total ICD-CPT Links: ${results.links.total}`, 
          results.links.total > 0 ? colors.cyan : colors.red);
    
    if (results.links.total === 0) {
      results.issues.push('icd_cpt_links table is EMPTY - needs to be populated');
    } else {
      // Check for orphan references
      const orphanICD = await pool.query(`
        SELECT COUNT(*) as count 
        FROM icd_cpt_links l
        LEFT JOIN icd_codes i ON l.icd_code = i.code
        WHERE i.code IS NULL
      `);
      
      const orphanCPT = await pool.query(`
        SELECT COUNT(*) as count 
        FROM icd_cpt_links l
        LEFT JOIN cpt_codes c ON l.cpt_code = c.code
        WHERE c.code IS NULL
      `);
      
      results.links.orphanICD = parseInt(orphanICD.rows[0].count);
      results.links.orphanCPT = parseInt(orphanCPT.rows[0].count);
      
      print(`Orphan ICD References: ${results.links.orphanICD}`, 
            results.links.orphanICD === 0 ? colors.green : colors.red);
      print(`Orphan CPT References: ${results.links.orphanCPT}`, 
            results.links.orphanCPT === 0 ? colors.green : colors.red);
      
      if (results.links.orphanICD > 0) {
        results.issues.push(`${results.links.orphanICD} orphan ICD references in icd_cpt_links`);
      }
      if (results.links.orphanCPT > 0) {
        results.issues.push(`${results.links.orphanCPT} orphan CPT references in icd_cpt_links`);
      }
      
      // Link quality
      const avgConfidence = await pool.query(`
        SELECT AVG(confidence_score) as avg_confidence 
        FROM icd_cpt_links
      `);
      
      if (avgConfidence.rows[0].avg_confidence) {
        results.links.avgConfidence = parseFloat(avgConfidence.rows[0].avg_confidence).toFixed(2);
        print(`Average Confidence Score: ${results.links.avgConfidence}`, colors.cyan);
      }
    }
    
    // 4. Specifiers Assessment
    printHeader('4. ICD SPECIFIERS ASSESSMENT');
    
    const specifiersTotal = await pool.query('SELECT COUNT(*) as count FROM icd_specifiers');
    results.specifiers.total = parseInt(specifiersTotal.rows[0].count);
    
    print(`Total Specifiers: ${results.specifiers.total}`, colors.cyan);
    
    // Check for orphan specifiers
    const orphanSpecifiers = await pool.query(`
      SELECT COUNT(DISTINCT root_code) as count
      FROM icd_specifiers s
      LEFT JOIN icd_codes i ON s.root_code = i.code
      WHERE i.code IS NULL
    `);
    
    results.specifiers.orphans = parseInt(orphanSpecifiers.rows[0].count);
    print(`Orphan Root Codes: ${results.specifiers.orphans}`, 
          results.specifiers.orphans === 0 ? colors.green : colors.yellow);
    
    if (results.specifiers.orphans > 0) {
      results.warnings.push(`${results.specifiers.orphans} specifier root codes don't exist in icd_codes`);
    }
    
    // Specifiers by dimension
    const specifiersByDimension = await pool.query(`
      SELECT dimension, COUNT(*) as count
      FROM icd_specifiers
      GROUP BY dimension
      ORDER BY COUNT(*) DESC
    `);
    
    printSection('Specifiers by Dimension');
    specifiersByDimension.rows.forEach(row => {
      print(`  ${row.dimension}: ${row.count}`, colors.cyan);
    });
    
    // 5. Database Extensions
    printHeader('5. DATABASE EXTENSIONS & CONFIGURATION');
    
    const pgvectorCheck = await pool.query(`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `);
    
    results.pgvector = pgvectorCheck.rows.length > 0;
    print(`pgvector Extension: ${results.pgvector ? 'INSTALLED' : 'MISSING'}`, 
          results.pgvector ? colors.green : colors.red);
    
    if (!results.pgvector) {
      results.issues.push('pgvector extension is not installed - required for vector operations');
    }
    
    // Check indexes
    const indexes = await pool.query(`
      SELECT tablename, indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
      AND tablename IN ('icd_codes', 'cpt_codes', 'icd_cpt_links')
    `);
    
    printSection('Database Indexes');
    const indexesByTable = {};
    indexes.rows.forEach(row => {
      if (!indexesByTable[row.tablename]) {
        indexesByTable[row.tablename] = [];
      }
      indexesByTable[row.tablename].push(row.indexname);
    });
    
    Object.entries(indexesByTable).forEach(([table, indexes]) => {
      print(`  ${table}: ${indexes.length} indexes`, colors.cyan);
    });
    
    // 6. Calculate Data Quality Score
    printHeader('6. DATA QUALITY SCORE');
    
    let score = 0;
    
    // ICD Embeddings (30 points)
    score += Math.min(30, (results.icd.coverage / 100) * 30);
    
    // CPT Embeddings (30 points)
    score += Math.min(30, (results.cpt.coverage / 100) * 30);
    
    // Links exist (15 points)
    score += results.links.total > 0 ? 15 : 0;
    
    // No orphans (15 points)
    const hasOrphans = (results.links.orphanICD || 0) + (results.links.orphanCPT || 0);
    score += hasOrphans === 0 ? 15 : Math.max(0, 15 - hasOrphans);
    
    // pgvector installed (10 points)
    score += results.pgvector ? 10 : 0;
    
    results.score = Math.round(score);
    
    const scoreColor = results.score >= 90 ? colors.green : 
                       results.score >= 70 ? colors.yellow : colors.red;
    
    print(`\nOverall Data Quality Score: ${results.score}/100`, colors.bright + scoreColor);
    
    // Interpretation
    if (results.score >= 90) {
      print('✅ EXCELLENT - Database is in great shape!', colors.green);
    } else if (results.score >= 70) {
      print('⚠️  GOOD - Some improvements needed before Phase 2', colors.yellow);
    } else if (results.score >= 50) {
      print('⚠️  FAIR - Significant work needed in Phase 1', colors.yellow);
    } else {
      print('❌ POOR - Critical issues must be addressed', colors.red);
    }
    
    // 7. Issues Summary
    if (results.issues.length > 0) {
      printHeader('7. CRITICAL ISSUES TO FIX');
      results.issues.forEach((issue, i) => {
        print(`${i + 1}. ${issue}`, colors.red);
      });
    }
    
    if (results.warnings.length > 0) {
      printHeader('8. WARNINGS');
      results.warnings.forEach((warning, i) => {
        print(`${i + 1}. ${warning}`, colors.yellow);
      });
    }
    
    // 8. Recommendations
    printHeader('RECOMMENDATIONS FOR PHASE 1');
    
    if (results.icd.withoutEmbeddings > 0) {
      print(`1. Generate ${results.icd.withoutEmbeddings} missing ICD embeddings`, colors.cyan);
      print(`   Estimated cost: $${(results.icd.withoutEmbeddings * 0.00002).toFixed(2)}`, colors.cyan);
      print(`   Estimated time: ~${Math.ceil(results.icd.withoutEmbeddings / 1000)} hours (with parallel processing)`, colors.cyan);
    }
    
    if (results.cpt.withoutEmbeddings > 0) {
      print(`\n2. Generate ${results.cpt.withoutEmbeddings} missing CPT embeddings`, colors.cyan);
      print(`   Estimated cost: $${(results.cpt.withoutEmbeddings * 0.00002).toFixed(2)}`, colors.cyan);
      print(`   Estimated time: ~${Math.ceil(results.cpt.withoutEmbeddings / 1000)} hours (with parallel processing)`, colors.cyan);
    }
    
    if (results.links.total === 0) {
      print(`\n3. Populate icd_cpt_links table with similarity-based relationships`, colors.cyan);
      print(`   Estimated links: ~${results.icd.total * 10} (10 CPTs per ICD)`, colors.cyan);
    }
    
    if (hasOrphans > 0) {
      print(`\n4. Clean up ${hasOrphans} orphan references in database`, colors.cyan);
    }
    
    // 9. Next Steps
    printHeader('NEXT STEPS');
    
    print('1. Review this diagnostic report', colors.cyan);
    print('2. Run: node scripts/parallel-embedding-generator.js --dry-run', colors.cyan);
    print('3. Execute: node scripts/parallel-embedding-generator.js --icd --cpt', colors.cyan);
    print('4. Validate: node scripts/validate-data-integrity.js', colors.cyan);
    print('5. Populate: node scripts/populate-icd-cpt-links.js', colors.cyan);
    
    // Save report to file
    const reportPath = join(__dirname, '../diagnostic-report.json');
    const fs = await import('fs');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    print(`\n📊 Full report saved to: ${reportPath}`, colors.green);
    
  } catch (error) {
    print('\n❌ Error running diagnostics:', colors.red);
    console.error(error);
  } finally {
    await pool.end();
    print('\n✅ Diagnostic complete!\n', colors.green);
  }
}

// Run diagnostics
runDiagnostics().catch(console.error);

