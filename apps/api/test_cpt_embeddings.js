// Test CPT embeddings with 100 codes
import { Pool } from 'pg';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function testCPTEmbeddings() {
  console.log('🧪 Generating embeddings for 100 CPT codes...\n');
  
  try {
    // Get 100 codes without embeddings
    const result = await pool.query(`
      SELECT code, display, short_description
      FROM cpt_codes
      WHERE display_embedding IS NULL
      AND active = true
      ORDER BY code
      LIMIT 100
    `);
    
    const codes = result.rows;
    console.log(`📋 Processing ${codes.length} CPT codes\n`);
    
    let success = 0;
    let failed = 0;
    
    // Process in batch of 100
    const searchTexts = codes.map(c => 
      `${c.code} ${c.display} ${c.short_description || ''}`
    );
    
    console.log('🤖 Generating batch embeddings...');
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: searchTexts
    });
    
    const embeddings = response.data.map(item => item.embedding);
    console.log(`✅ Generated ${embeddings.length} embeddings\n`);
    
    // Store each embedding
    console.log('💾 Storing embeddings in database...');
    for (let i = 0; i < codes.length; i++) {
      try {
        await pool.query(
          'UPDATE cpt_codes SET display_embedding = $1 WHERE code = $2',
          [JSON.stringify(embeddings[i]), codes[i].code]
        );
        success++;
        if ((i + 1) % 25 === 0) {
          console.log(`   ✓ Stored ${i + 1}/${codes.length}`);
        }
      } catch (error) {
        console.error(`   ❌ Failed ${codes[i].code}:`, error.message);
        failed++;
      }
    }
    
    console.log(`\n📊 Results:`);
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
    
    // Final status
    const finalStatus = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(display_embedding) as with_embeddings
      FROM cpt_codes
    `);
    
    const final = finalStatus.rows[0];
    console.log(`\n📈 Total CPT embeddings: ${final.with_embeddings}/${final.total} (${((final.with_embeddings/final.total)*100).toFixed(1)}%)\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testCPTEmbeddings();

