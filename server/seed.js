// 1. Force load the environment variables from your .env file
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('./src/db'); 

async function seedExercises() {
  try {
    const filePath = path.join(__dirname, 'exercises.json');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const exercises = JSON.parse(rawData);

    console.log(`🚀 Found ${exercises.length} exercises in dataset. Starting bulk insertion...`);

    for (const ex of exercises) {
      await db.query(
        `INSERT INTO exercises (name, body_part, equipment, target_muscle, gif_url) 
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING`, 
        [
          ex.name, 
          ex.body_part, 
          ex.equipment, 
          ex.target || ex.muscle_group, 
          ex.gif_url
        ]
      );
    }

    const countCheck = await db.query('SELECT COUNT(*) FROM exercises');
    console.log(`\n🎉 Success! Seeding complete.`);
    console.log(`📊 Exercises now living in your cloud DB: ${countCheck.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

seedExercises();