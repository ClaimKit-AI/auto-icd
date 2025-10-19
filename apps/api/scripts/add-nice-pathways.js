// Add NICE-Recommended CPT codes to links table
// Boosts medically appropriate codes that vector similarity might miss

import dotenv from 'dotenv'
dotenv.config()

import { query } from '../src/database.js'

// NICE Clinical Pathways (Evidence-Based First-Line Tests/Procedures)
const NICE_PATHWAYS = [
  // Thyroid Disorders
  { icd: 'E03%', cpts: ['84443', '84480', '84439'], score: 0.95, reason: 'NICE: First-line thyroid function tests' },
  { icd: 'E05%', cpts: ['84443', '84480', '84439'], score: 0.95, reason: 'NICE: Hyperthyroidism workup' },
  
  // Diabetes
  { icd: 'E11%', cpts: ['82947', '83036', '85025', '80053'], score: 0.95, reason: 'NICE: Diabetes monitoring' },
  { icd: 'E10%', cpts: ['82947', '83036', '85025', '80053'], score: 0.95, reason: 'NICE: Type 1 diabetes' },
  
  // Anemia  
  { icd: 'D50%', cpts: ['85025', '82728', '83540'], score: 0.95, reason: 'NICE: Iron deficiency anemia workup' },
  { icd: 'D64%', cpts: ['85025', '85027', '82728'], score: 0.95, reason: 'NICE: Anemia investigation' },
  
  // Hypertension
  { icd: 'I10%', cpts: ['93000', '80053', '85025'], score: 0.95, reason: 'NICE: Hypertension workup' },
]

async function addNICEPathways() {
  console.log('🏥 Adding NICE-Recommended Pathways to Links Table')
  console.log('='.repeat(70))
  
  let added = 0
  let updated = 0
  
  for (const pathway of NICE_PATHWAYS) {
    console.log(`\n📋 ${pathway.reason}`)
    console.log(`   ICD pattern: ${pathway.icd}`)
    console.log(`   CPT codes: ${pathway.cpts.join(', ')}`)
    
    // Get matching ICD codes
    const icdResult = await query(`
      SELECT code FROM icd_codes  
      WHERE code LIKE $1
    `, [pathway.icd])
    
    console.log(`   Found ${icdResult.rows.length} matching ICD codes`)
    
    // Add/update links for each ICD
    for (const icd of icdResult.rows) {
      for (const cptCode of pathway.cpts) {
        try {
          await query(`
            INSERT INTO icd_cpt_links (icd_code, cpt_code, confidence_score)
            VALUES ($1, $2, $3)
            ON CONFLICT (icd_code, cpt_code) 
            DO UPDATE SET 
              confidence_score = GREATEST(icd_cpt_links.confidence_score, EXCLUDED.confidence_score)
          `, [icd.code, cptCode, pathway.score])
          
          added++
        } catch (err) {
          console.error(`     ❌ ${icd.code} + ${cptCode}:`, err.message)
        }
      }
    }
    
    console.log(`   ✅ Added/updated ${icdResult.rows.length * pathway.cpts.length} links`)
  }
  
  console.log('\n' + '='.repeat(70))
  console.log(`✅ NICE pathways added: ${added} links`)
  console.log('='.repeat(70))
}

addNICEPathways().then(() => {
  console.log('\n✅ Complete!')
  process.exit(0)
}).catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

