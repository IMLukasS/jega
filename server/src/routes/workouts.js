const express = require('express');
const router = express.Router();
const db = require('../db'); // Import our database connection pool

// 1. POST /api/v1/workouts - Create a workout session in the cloud
router.post('/', async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Workout name is required' });
  }

  try {
    const queryText = `
      INSERT INTO workout_logs (name, notes) 
      VALUES ($1, $2) 
      RETURNING id, name, started_at, notes;
    `;
    const result = await db.query(queryText, [name, req.body.notes || null]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in POST /api/v1/workouts:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 2. GET /api/v1/workouts - Retrieve all sessions from the cloud
router.get('/', async (req, res) => {
  try {
    // Senior Dev Standard: Sort by latest workout first using ORDER BY
    const queryText = `
      SELECT id, name, started_at, completed_at, notes 
      FROM workout_logs 
      ORDER BY started_at DESC;
    `;
    const result = await db.query(queryText);
    
    // Always return a 200 OK with an array, even if empty
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database Error in GET /api/v1/workouts:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 3. GET /api/v1/workouts/:id - Retrieve a single workout WITH its sets from the cloud
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const workoutQuery = `SELECT * FROM workout_logs WHERE id = $1;`;
    const workoutResult = await db.query(workoutQuery, [id]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: `Workout with ID ${id} not found` });
    }

    const workout = workoutResult.rows[0];

    // NEW: We use a JOIN here to merge the sets with the exercises table!
    const setsQuery = `
      SELECT 
        sl.id, sl.set_number, sl.actual_weight_kg, sl.actual_reps, sl.rpe, sl.completed_at,
        e.name AS exercise_name
      FROM set_logs sl
      JOIN exercises e ON sl.exercise_id = e.id
      WHERE sl.workout_log_id = $1
      ORDER BY sl.id ASC;
    `;
    const setsResult = await db.query(setsQuery, [id]);

    return res.status(200).json({
      ...workout,
      sets: setsResult.rows
    });
  } catch (error) {
    console.error(`Database Error in GET /api/v1/workouts/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 4. POST /api/v1/workouts/:id/sets - Log a set for a specific workout in the cloud
router.post('/:id/sets', async (req, res) => {
  const { id } = req.params; // This is the workout_log_id
  const { exercise_id, set_number, actual_weight_kg, actual_reps, rpe } = req.body;

  // Validation Guard Clause
  if (!exercise_id || !set_number || !actual_weight_kg || !actual_reps) {
    return res.status(400).json({ error: 'exercise_id, set_number, actual_weight_kg, and actual_reps are required' });
  }

  try {
    // Integrity Check: Does the parent workout exist?
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1;', [id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: `Cannot log set. Workout log ${id} does not exist.` });
    }

    // Insert the new set record using parameterized query variables ($1, $2...)
    const queryText = `
      INSERT INTO set_logs (workout_log_id, exercise_id, set_number, actual_weight_kg, actual_reps, rpe)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const values = [id, exercise_id, set_number, actual_weight_kg, actual_reps, rpe || null];
    
    const result = await db.query(queryText, values);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in POST /api/v1/workouts/:id/sets:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

module.exports = router;