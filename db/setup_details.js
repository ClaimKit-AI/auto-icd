// Setup script for diagnosis details table
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres.efijoenjahkldathipjl:gaddouhaA1%40%40@aws-1-us-east-2.pooler.supabase.com:5432/postgres'
});

async function setupDetailsTable() {
  try {
    // Create the table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS icd_diagnosis_details (
        code TEXT PRIMARY KEY,
        description TEXT,
        clinical_notes TEXT,
        symptoms TEXT[],
        risk_factors TEXT[],
        complications TEXT[],
        treatment_notes TEXT,
        icd_chapter TEXT,
        icd_block TEXT,
        icd_category TEXT,
        body_system TEXT,
        severity_levels TEXT[],
        age_groups TEXT[],
        gender_preference TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    
    console.log('✅ Table created successfully');
    
    // Insert sample data
    await pool.query(`
      INSERT INTO icd_diagnosis_details (code, description, clinical_notes, symptoms, risk_factors, complications, treatment_notes, icd_chapter, icd_block, icd_category, body_system, severity_levels, age_groups, gender_preference) VALUES
      ('I10', 'Essential (primary) hypertension is a chronic medical condition characterized by persistently elevated blood pressure without an identifiable secondary cause.', 'Blood pressure consistently ≥140/90 mmHg on multiple readings. Requires lifestyle modifications and often antihypertensive medications.', '["Often asymptomatic", "Headaches", "Dizziness", "Chest pain", "Shortness of breath", "Visual changes"]', '["Family history", "Age >65", "Obesity", "Sedentary lifestyle", "High sodium diet", "Excessive alcohol", "Smoking", "Stress"]', '["Heart disease", "Stroke", "Kidney disease", "Eye damage", "Metabolic syndrome"]', 'Lifestyle modifications (diet, exercise, weight loss) and antihypertensive medications. Regular monitoring required.', 'Diseases of the circulatory system', 'Hypertensive diseases', 'Essential hypertension', 'Cardiovascular system', '["Mild", "Moderate", "Severe"]', '["Adults", "Elderly"]', 'None'),
      ('E11.9', 'Type 2 diabetes mellitus without complications is a chronic metabolic disorder characterized by insulin resistance and relative insulin deficiency.', 'Fasting glucose ≥126 mg/dL or HbA1c ≥6.5%. Managed with lifestyle modifications, oral medications, and/or insulin.', '["Increased thirst", "Frequent urination", "Fatigue", "Blurred vision", "Slow healing", "Recurrent infections"]', '["Obesity", "Family history", "Age >45", "Sedentary lifestyle", "High blood pressure", "Abnormal cholesterol", "Gestational diabetes history"]', '["Diabetic ketoacidosis", "Hyperosmolar hyperglycemic state", "Cardiovascular disease", "Neuropathy", "Nephropathy", "Retinopathy"]', 'Blood glucose monitoring, dietary management, regular exercise, oral antidiabetic agents, and insulin therapy as needed.', 'Endocrine, nutritional and metabolic diseases', 'Diabetes mellitus', 'Type 2 diabetes mellitus', 'Endocrine system', '["Mild", "Moderate", "Severe"]', '["Adults", "Elderly"]', 'None'),
      ('S52.5', 'Fracture of radius is a break in the radius bone of the forearm, commonly occurring at the distal end near the wrist.', 'Most common fracture in adults. Often results from fall on outstretched hand. Requires immobilization and may need surgical intervention.', '["Severe pain", "Swelling", "Bruising", "Deformity", "Limited range of motion", "Tenderness"]', '["Osteoporosis", "Age >50", "Female gender", "Previous fractures", "Falls", "High-impact trauma"]', '["Nonunion", "Malunion", "Stiffness", "Nerve damage", "Compartment syndrome", "Complex regional pain syndrome"]', 'Immobilization with cast or splint, pain management, physical therapy. Surgical fixation may be required for displaced fractures.', 'Injury, poisoning and certain other consequences of external causes', 'Fractures of forearm', 'Fracture of radius', 'Musculoskeletal system', '["Mild", "Moderate", "Severe"]', '["Adults", "Elderly"]', 'Female')
      ON CONFLICT (code) DO NOTHING;
    `);
    
    console.log('✅ Sample data inserted successfully');
    
  } catch (error) {
    console.error('❌ Error setting up details table:', error);
  } finally {
    await pool.end();
  }
}

setupDetailsTable();
