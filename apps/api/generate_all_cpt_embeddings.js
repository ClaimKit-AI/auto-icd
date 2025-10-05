// Generate ALL remaining CPT embeddings in batches of 100
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

async function generateAllCPTEmbeddings() {
  console.log('🚀 Generating ALL CPT embeddings in batches...\n');
  
  try {
    let totalGenerated = 0;
    let batchCount = 0;
    const startTime = Date.now();
    
    while (true) {
      // Check how many are left
      const statusResult = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(display_embedding) as with_embeddings
        FROM cpt_codes
        WHERE active = true
      `);
      
      const stats = statusResult.rows[0];
      const remaining = stats.total - stats.with_embeddings;
      
      if (remaining === 0) {
        console.log('\n✅ All CPT codes have embeddings!');
        break;
      }
      
      batchCount++;
      console.log(`\n🔄 Batch ${batchCount} | Remaining: ${remaining}`);
      
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
      
      if (codes.length === 0) {
        break;
      }
      
      // Generate batch embeddings
      const searchTexts = codes.map(c => 
        `${c.code} ${c.display} ${c.short_description || ''}`
      );
      
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: searchTexts
      });
      
      const embeddings = response.data.map(item => item.embedding);
      
      // Store embeddings
      for (let i = 0; i < codes.length; i++) {
        await pool.query(
          'UPDATE cpt_codes SET display_embedding = $1 WHERE code = $2',
          [JSON.stringify(embeddings[i]), codes[i].code]
        );
      }
      
      totalGenerated += codes.length;
      
      // Progress
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalGenerated / elapsed;
      const eta = Math.ceil((stats.total - stats.with_embeddings - codes.length) / rate);
      
      console.log(`   ✅ Generated: ${codes.length} embeddings`);
      console.log(`   📊 Total: ${stats.with_embeddings + codes.length}/${stats.total} (${((stats.with_embeddings + codes.length)/stats.total*100).toFixed(1)}%)`);
      console.log(`   ⏱️  Rate: ${rate.toFixed(1)} codes/sec | ETA: ${Math.floor(eta/60)}m ${eta%60}s`);
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log(`\n🎉 Complete!`);
    console.log(`   Total generated: ${totalGenerated}`);
    console.log(`   Time: ${totalTime} minutes`);
    console.log(`   Cost: ~$${(totalGenerated * 0.00002).toFixed(2)}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

generateAllCPTEmbeddings();

