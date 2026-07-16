const express = require('express');
const router = express.Router();
const db = require('../db'); // Import our database connection pool

// 1. POST /api/v1/workouts - Create a workout session in the cloud
router.post('/', async (req, res) => {
  // ---> UPDATE: Destructure routine_id from the body so we can link templates to workouts
  const { name, routine_id, notes } = req.body; 

  if (!name) {
    return res.status(400).json({ error: 'Workout name is required' });
  }

  try {
    // ---> UPDATE: Insert the routine_id column
    const queryText = `
      INSERT INTO workout_logs (name, routine_id, notes) 
      VALUES ($1, $2, $3) 
      RETURNING id, name, routine_id, started_at, notes;
    `;
    const result = await db.query(queryText, [
      name, 
      routine_id || null, 
      notes || null
    ]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in POST /api/v1/workouts:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 2. GET /api/v1/workouts - Retrieve all sessions from the cloud
router.get('/', async (req, res) => {
  try {
    const queryText = `
      SELECT id, name, started_at, completed_at, duration_seconds, notes 
      FROM workout_logs 
      ORDER BY started_at DESC;
    `;
    const result = await db.query(queryText);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database Error in GET /api/v1/workouts:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 3. GET /api/v1/workouts/:id - Retrieve a single workout WITH its sets and tags from the cloud
router.get('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const workoutQuery = `SELECT * FROM workout_logs WHERE id = $1;`;
    const workoutResult = await db.query(workoutQuery, [id]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: `Workout with ID ${id} not found` });
    }

    const workout = workoutResult.rows[0];

    // ---> UPDATE: Joined workout_logs and routine_exercises to extract matching tags!
    const setsQuery = `
      SELECT 
        sl.id, 
        sl.set_number, 
        sl.actual_weight_kg, 
        sl.actual_reps, 
        sl.time_minutes, 
        sl.time_seconds, 
        sl.distance, 
        sl.rpe, 
        sl.completed_at,
        COALESCE(e.title, 'Freestyle Exercise') AS exercise_name, -- 💡 Fallback text if exercise doesn't exist
        COALESCE(e.tracking_type, 'weight_reps') AS tracking_type,
        re.tags
      FROM set_logs sl
      LEFT JOIN exercises e ON sl.exercise_id = e.id -- 💡 Changed from JOIN to LEFT JOIN
      JOIN workout_logs wl ON sl.workout_log_id = wl.id 
      LEFT JOIN routine_exercises re ON re.routine_id = wl.routine_id AND re.exercise_id = sl.exercise_id 
      WHERE sl.workout_log_id = $1
      ORDER BY sl.id ASC;
    `;
    const setsResult = await db.query(setsQuery, [id]);

    // ---> UPDATE: Clean set results to ensure tags default to [] (never null) 
    // This keeps the React frontend from throwing type-errors on freestyle workouts.
    const setsWithTags = setsResult.rows.map(row => ({
      ...row,
      tags: row.tags || []
    }));

    return res.status(200).json({
      ...workout,
      sets: setsWithTags
    });
  } catch (error) {
    console.error(`Database Error in GET /api/v1/workouts/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 4. POST /api/v1/workouts/:id/sets - Log a set for a specific workout (UNCHANGED)
router.post('/:id/sets', async (req, res) => {
  const { id } = req.params;
  const { 
    exercise_id, 
    set_number, 
    actual_weight_kg, 
    actual_reps, 
    rpe, 
    time_minutes, 
    time_seconds, 
    distance 
  } = req.body;

  if (!exercise_id || !set_number) {
    return res.status(400).json({ error: 'exercise_id and set_number are required' });
  }

  try {
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1;', [id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: `Cannot log set. Workout log ${id} does not exist.` });
    }

    const queryText = `
      INSERT INTO set_logs (
        workout_log_id, 
        exercise_id, 
        set_number, 
        actual_weight_kg, 
        actual_reps, 
        rpe, 
        time_minutes, 
        time_seconds, 
        distance
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    
    const values = [
      id, 
      exercise_id, 
      set_number, 
      actual_weight_kg !== undefined ? actual_weight_kg : null, 
      actual_reps !== undefined ? actual_reps : null, 
      rpe || null,
      time_minutes !== undefined ? time_minutes : null,
      time_seconds !== undefined ? time_seconds : null,
      distance !== undefined ? distance : null
    ];
    
    const result = await db.query(queryText, values);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in POST /api/v1/workouts/:id/sets:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 5. PUT /api/v1/workouts/:id/sets/:setId - Update an already logged set
router.put('/:id/sets/:setId', async (req, res) => {
  const { id, setId } = req.params;
  const { 
    actual_weight_kg, 
    actual_reps, 
    rpe, 
    time_minutes, 
    time_seconds, 
    distance 
  } = req.body;

  try {
    // 1. Double check that the parent workout log exists
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1;', [id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: `Workout log ${id} does not exist.` });
    }

    // 2. Perform the update query on the specific set row
    const queryText = `
      UPDATE set_logs 
      SET 
        actual_weight_kg = $1, 
        actual_reps = $2, 
        rpe = $3, 
        time_minutes = $4, 
        time_seconds = $5, 
        distance = $6
      WHERE id = $7 AND workout_log_id = $8
      RETURNING *;
    `;
    
    const values = [
      actual_weight_kg !== undefined ? actual_weight_kg : null, 
      actual_reps !== undefined ? actual_reps : null, 
      rpe || null,
      time_minutes !== undefined ? time_minutes : null,
      time_seconds !== undefined ? time_seconds : null,
      distance !== undefined ? distance : null,
      setId,
      id
    ];
    
    const result = await db.query(queryText, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Set log with ID ${setId} not found under this workout.` });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in PUT /api/v1/workouts/:id/sets/:setId:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 6. DELETE /api/v1/workouts/:id - Delete a single workout session and all its associated sets
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Delete all dependent set logs first to prevent foreign key constraint errors
    await db.query('DELETE FROM set_logs WHERE workout_log_id = $1;', [id]);

    // 2. Delete the parent workout log entry
    const result = await db.query('DELETE FROM workout_logs WHERE id = $1 RETURNING *;', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Workout log with ID ${id} not found.` });
    }

    return res.status(200).json({ 
      message: 'Workout log and all associated set logs deleted successfully.',
      deletedWorkout: result.rows[0] 
    });
  } catch (error) {
    console.error(`Database Error in DELETE /api/v1/workouts/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 7. PATCH /api/v1/workouts/:id - Update workout session details (like duration and completion)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { duration_seconds } = req.body;

  try {
    // Updates the duration and stamps the completion time simultaneously
    const queryText = `
      UPDATE workout_logs 
      SET 
        duration_seconds = $1,
        completed_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    
    const result = await db.query(queryText, [
      duration_seconds !== undefined ? Number(duration_seconds) : null, 
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Workout log with ID ${id} not found.` });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Database Error in PATCH /api/v1/workouts/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

module.exports = router;