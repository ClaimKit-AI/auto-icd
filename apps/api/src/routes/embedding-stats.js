// Embedding Statistics API Route
// Shows current embedding coverage in database

import { query } from '../database.js';

export async function embeddingStatsRoutes(fastify, options) {
  
  // GET /api/stats/embeddings - Get embedding statistics
  fastify.get('/embeddings', async (request, reply) => {
    try {
      // Get ICD stats
      const icdStats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(title_embedding) as with_embedding,
          COUNT(*) - COUNT(title_embedding) as without_embedding
        FROM icd_codes
      `);
      
      // Get CPT stats
      const cptStats = await query(`
        SELECT 
          COUNT(*) as total,
          COUNT(display_embedding) as with_embedding,
          COUNT(*) - COUNT(display_embedding) as without_embedding
        FROM cpt_codes
        WHERE active = true
      `);
      
      // Get CPT by chapter
      const cptByChapter = await query(`
        SELECT 
          chapter,
          COUNT(*) as total,
          COUNT(display_embedding) as with_embedding,
          ROUND((COUNT(display_embedding)::numeric / COUNT(*) * 100), 1) as percentage
        FROM cpt_codes
        WHERE active = true
        GROUP BY chapter
        ORDER BY COUNT(display_embedding) DESC
      `);
      
      // Get testable ICD count (codes with CPT matches)
      const testableCount = await query(`
        SELECT COUNT(DISTINCT i.code) as testable
        FROM icd_codes i
        WHERE i.title_embedding IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM cpt_codes c
            WHERE c.display_embedding IS NOT NULL
              AND c.active = true
          )
      `);
      
      const icd = icdStats.rows[0];
      const cpt = cptStats.rows[0];
      const testable = testableCount.rows[0];
      
      reply.send({
        timestamp: new Date().toISOString(),
        icd_codes: {
          total: parseInt(icd.total),
          with_embedding: parseInt(icd.with_embedding),
          without_embedding: parseInt(icd.without_embedding),
          coverage_pct: ((icd.with_embedding / icd.total) * 100).toFixed(2)
        },
        cpt_codes: {
          total: parseInt(cpt.total),
          with_embedding: parseInt(cpt.with_embedding),
          without_embedding: parseInt(cpt.without_embedding),
          coverage_pct: ((cpt.with_embedding / cpt.total) * 100).toFixed(2)
        },
        cpt_by_chapter: cptByChapter.rows.map(row => ({
          chapter: row.chapter,
          total: parseInt(row.total),
          with_embedding: parseInt(row.with_embedding),
          percentage: parseFloat(row.percentage)
        })),
        testable_combinations: parseInt(testable.testable),
        total_embedded: parseInt(icd.with_embedding) + parseInt(cpt.with_embedding)
      });
      
    } catch (error) {
      console.error('Error getting embedding stats:', error);
      reply.status(500).send({ error: 'Failed to get embedding statistics' });
    }
  });
}

