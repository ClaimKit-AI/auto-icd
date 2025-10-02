// Check CPT loading status
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkStatus() {
  try {
    console.log('🔍 Checking CPT status...\n');
    
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(display_embedding) as with_embeddings,
        COUNT(*) - COUNT(display_embedding) as without_embeddings
      FROM cpt_codes
    `);
    
    const stats = result.rows[0];
    
    console.log('📊 CPT Code Status:');
    console.log(`   Total codes: ${stats.total}`);
    console.log(`   With embeddings: ${stats.with_embeddings}`);
    console.log(`   Without embeddings: ${stats.without_embeddings}`);
    console.log(`   Progress: ${((stats.with_embeddings / stats.total) * 100).toFixed(1)}%\n`);
    
    if (stats.total > 0) {
      // Show sample
      const sample = await pool.query('SELECT code, display, chapter FROM cpt_codes LIMIT 5');
      console.log('📄 Sample CPT codes:');
      sample.rows.forEach(row => {
        console.log(`   ${row.code}: ${row.display.substring(0, 60)}...`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkStatus();

