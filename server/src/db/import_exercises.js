require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('.'); // Adjust this path to match your db connection file

// Change 'dataset.csv' to the EXACT name of the file in your project folder
const csvFilePath = path.join(__dirname, 'megaGymDataset.csv'); 

async function importCSV() {
  console.log('🚀 Starting CSV import processing...');
  const rows = [];

  // 1. Read the CSV file and parse rows into memory
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => {
      rows.push(data);
    })
    .on('end', async () => {
      console.log(`📦 Parsed ${rows.length} rows from CSV. Inserting into PostgreSQL...`);
      
      // 2. Loop through every row and insert into your clean table
      let successCount = 0;
      
      for (const row of rows) {
        // Double-check the column headers below match your CSV exactly!
        // If your CSV headers are lowercase or spaced differently, adjust the keys inside row[...]
        const queryText = `
  INSERT INTO exercises (
    title, short_description, exercise_type, body_part, 
    equipment, difficulty_level, rating, rating_description
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
`;

const values = [
  row['Title'] || null,
  row['Desc'] || null,        // Fixed from row['Short description']
  row['Type'] || null,        // Fixed from row['Type of exercise']
  row['BodyPart'] || null,    // Fixed from row['BodyPart']
  row['Equipment'] || null,   // Fixed from row['Equipment needed for the workout']
  row['Level'] || null,       // Fixed from row['Level']
  parseFloat(row['Rating']) || 0.0,
  row['RatingDesc'] || null   // Fixed from row['Description for the rating']
];

        try {
          await db.query(queryText, values);
          successCount++;
        } catch (err) {
          console.error(`❌ Failed to insert row: ${row['Title'] || 'Unknown'}. Error:`, err.message);
        }
      }

      console.log(`🎉 Success! Successfully imported ${successCount} out of ${rows.length} exercises into the database.`);
      process.exit(0); // Exit script cleanly
    });
}

importCSV();