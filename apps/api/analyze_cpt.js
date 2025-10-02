// Analyze CPT Excel file structure
import XLSX from 'xlsx';

async function analyzeCPT() {
  console.log('📊 Analyzing CPT Excel file...\n');
  
  try {
    // Read the Excel file
    const workbook = XLSX.readFile('../../CPT - fatma aljabri.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`✅ Total rows: ${data.length}`);
    console.log(`📋 Columns:`, Object.keys(data[0] || {}));
    console.log(`\n📄 Sample rows (first 3):`);
    data.slice(0, 3).forEach((row, i) => {
      console.log(`\nRow ${i + 1}:`, JSON.stringify(row, null, 2));
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

analyzeCPT();

