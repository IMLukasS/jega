const express = require('express');
const router = express.Router();
const db = require('../db'); // Ensure this points to your database pool

// GET /api/v1/exercises
// Fetches all available exercises for the template builder modal
router.get('/', async (req, res) => {
  try {
    // We update this to grab your new columns: title, body_part, and equipment
    // This is what powers the nice search filtering and visual tags in the frontend modal!
    const query = `
      SELECT id, title, body_part, equipment, exercise_type, short_description 
      FROM exercises 
      ORDER BY title ASC;
    `;
    const result = await db.query(query);
    
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database Error in GET /api/v1/exercises:', error);
    res.status(500).json({ error: 'Internal Server Error fetching exercises.' });
  }
});

module.exports = router;