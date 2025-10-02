// Setup CPT Database Schema
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setupSchema() {
  console.log('🏗️  Setting up CPT database schema...\n');
  
  try {
    // Read the schema SQL file
    const schema = readFileSync('../../db/cpt_schema.sql', 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    
    console.log('✅ CPT schema created successfully!\n');
    
    // Verify tables exist
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name IN ('cpt_codes', 'icd_cpt_links')
    `);
    
    console.log('📋 Tables created:', result.rows.map(r => r.table_name));
    
  } catch (error) {
    console.error('❌ Error setting up schema:', error.message);
    throw error;
  } finally {
    await pool.end();
  }
}

setupSchema();

