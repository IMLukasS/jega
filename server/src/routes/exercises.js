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

// POST /api/v1/exercises – create a new custom exercise on the fly
router.post('/', auth, async (req, res) => {
  const { title } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Exercise title is required.' });
  }

  try {
    // Check if it already exists (case‑insensitive) – avoid duplicates
    const existing = await db.query(
      'SELECT id, title, tracking_type FROM exercises WHERE LOWER(title) = LOWER($1) LIMIT 1',
      [title.trim()]
    );
    if (existing.rows.length > 0) {
      return res.json(existing.rows[0]);
    }

    const result = await db.query(
      'INSERT INTO exercises (title) VALUES ($1) RETURNING id, title, tracking_type',
      [title.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating exercise:', error);
    res.status(500).json({ error: 'Failed to create exercise.' });
  }
});

module.exports = router;