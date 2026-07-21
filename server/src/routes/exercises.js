const express = require('express');
const router = express.Router();
const db = require('../db'); 
const auth = require('../middleware/auth'); // 🛡️ Import the security bouncer

// GET /api/v1/exercises
// Fetches all available exercises for the template builder modal (Protected)
router.get('/', auth, async (req, res) => {
  try {
    // Powers the search filtering and visual tags safely behind a logged-in session
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