const express = require('express');
const router = express.Router();
const db = require('../db'); // Your database connection

// GET /api/v1/routines
// Fetches all routines and bundles their exercises in the correct order
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id, 
        r.name,
        json_agg(
          json_build_object(
            'exercise_id', e.id,
            'name', e.name,
            'sequence_order', re.sequence_order,
            'target_sets', re.target_sets,
            'gif_url', e.gif_url
          ) ORDER BY re.sequence_order ASC
        ) AS exercises
      FROM routines r
      JOIN routine_exercises re ON r.id = re.routine_id
      JOIN exercises e ON re.exercise_id = e.id
      GROUP BY r.id, r.name
      ORDER BY r.created_at ASC;
    `;
    
    const result = await db.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching routines:', error);
    res.status(500).json({ error: 'Failed to fetch routines' });
  }
});

module.exports = router;