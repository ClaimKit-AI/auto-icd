// CHUNKED ICD-CPT Link Populator
// Processes in small batches to avoid timeout
// Fast and reliable

import dotenv from 'dotenv'
dotenv.config()

import { query } from '../src/database.js'

class ChunkedLinkPopulator {
  constructor() {
    this.stats = {
      icd_processed: 0,
      links_created: 0,
      start_time: Date.now()
    }
  }
  
  async populate() {
    console.log('⚡ Chunked ICD-CPT Link Populator')
    console.log('='.repeat(70))
    
    // Get total count
    const countResult = await query('SELECT COUNT(*) FROM icd_codes WHERE title_embedding IS NOT NULL')
    const totalICD = parseInt(countResult.rows[0].count)
    
    console.log(`\n📊 Total ICD codes to process: ${totalICD}`)
    console.log('   Processing in chunks of 100 ICDs...')
    
    const chunkSize = 100
    const linksPerICD = 10
    
    // Process in chunks
    for (let offset = 0; offset < totalICD; offset += chunkSize) {
      await this.processChunk(offset, chunkSize, linksPerICD)
      
      // Progress
      this.stats.icd_processed += chunkSize
      
      if (offset % 1000 === 0) {
        const elapsed = (Date.now() - this.stats.start_time) / 1000
        const rate = this.stats.icd_processed / elapsed
        const remaining = totalICD - this.stats.icd_processed
        const eta = remaining / rate
        
        console.log(`\n📊 Progress: ${this.stats.icd_processed}/${totalICD} (${((this.stats.icd_processed/totalICD)*100).toFixed(1)}%)`)
        console.log(`   Links created: ${this.stats.links_created}`)
        console.log(`   Rate: ${rate.toFixed(1)} ICD/s | ETA: ${Math.ceil(eta/60)} min`)
      }
    }
    
    this.printSummary()
  }
  
  async processChunk(offset, chunkSize, linksPerICD) {
    try {
      // Process chunk with vector similarity
      const result = await query(`
        WITH icd_chunk AS (
          SELECT code as icd_code, title, title_embedding
          FROM icd_codes
          WHERE title_embedding IS NOT NULL
          ORDER BY code
          LIMIT $1 OFFSET $2
        )
        SELECT 
          i.icd_code,
          c.code as cpt_code,
          1 - (i.title_embedding <=> c.display_embedding) as similarity_score
        FROM icd_chunk i
        CROSS JOIN LATERAL (
          SELECT code, display_embedding
          FROM cpt_codes
          WHERE display_embedding IS NOT NULL
          ORDER BY display_embedding <=> i.title_embedding
          LIMIT $3
        ) c
        WHERE (1 - (i.title_embedding <=> c.display_embedding)) > 0.38
      `, [chunkSize, offset, linksPerICD])
      
      if (result.rows.length === 0) return
      
      // Batch insert
      const values = result.rows.map((_, idx) => 
        `($${idx*3+1}, $${idx*3+2}, $${idx*3+3})`
      ).join(', ')
      
      const params = result.rows.flatMap(r => [
        r.icd_code,
        r.cpt_code,
        r.similarity_score
      ])
      
      await query(`
        INSERT INTO icd_cpt_links (icd_code, cpt_code, confidence_score)
        VALUES ${values}
        ON CONFLICT (icd_code, cpt_code) DO UPDATE
        SET confidence_score = EXCLUDED.confidence_score
      `, params)
      
      this.stats.links_created += result.rows.length
      
    } catch (error) {
      console.error(`❌ Chunk ${offset} error:`, error.message)
    }
  }
  
  printSummary() {
    const duration = (Date.now() - this.stats.start_time) / 1000
    
    console.log('\n' + '='.repeat(70))
    console.log('📊 SUMMARY')
    console.log('='.repeat(70))
    console.log(`ICD processed:    ${this.stats.icd_processed}`)
    console.log(`Links created:    ${this.stats.links_created}`)
    console.log(`Time:             ${(duration/60).toFixed(1)} minutes`)
    console.log(`Rate:             ${(this.stats.links_created/duration).toFixed(0)} links/second`)
    console.log('='.repeat(70))
  }
}

const run = async () => {
  const populator = new ChunkedLinkPopulator()
  await populator.populate()
}

run().catch(err => {
  console.error('❌ Error:', err)
  process.exit(1)
})

