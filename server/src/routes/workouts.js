const express = require('express');
const router = express.Router();
const db = require('../db'); 
const auth = require('../middleware/auth'); // 🛡️ Import the security gateway middleware

// 1. POST /api/v1/workouts - Create a workout session bound to the user
router.post('/', auth, async (req, res) => {
  const { name, routine_id, notes } = req.body; 

  if (!name) {
    return res.status(400).json({ error: 'Workout name is required' });
  }

  try {
    // 🔒 Securely bind the session to req.user.id extracted from the JWT token
    const queryText = `
      INSERT INTO workout_logs (name, routine_id, notes, user_id) 
      VALUES ($1, $2, $3, $4) 
      RETURNING id, name, routine_id, started_at, notes;
    `;
    const result = await db.query(queryText, [
      name, 
      routine_id || null, 
      notes || null,
      req.user.id
    ]);
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in POST /api/v1/workouts:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 2. GET /api/v1/workouts - Retrieve sessions belonging exclusively to the logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const queryText = `
      SELECT id, name, started_at, completed_at, duration_seconds, notes 
      FROM workout_logs 
      WHERE user_id = $1 -- 🔒 User Isolation Filter
      ORDER BY started_at DESC;
    `;
    const result = await db.query(queryText, [req.user.id]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Database Error in GET /api/v1/workouts:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 3. GET /api/v1/workouts/:id - Retrieve a single workout ensuring ownership
router.get('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 🔒 Double-check ownership: ensure the resource belongs to the current token user
    const workoutQuery = `SELECT * FROM workout_logs WHERE id = $1 AND user_id = $2;`;
    const workoutResult = await db.query(workoutQuery, [id, req.user.id]);

    if (workoutResult.rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found' });
    }

    const workout = workoutResult.rows[0];

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
        COALESCE(e.title, 'Freestyle Exercise') AS exercise_name, 
        COALESCE(e.tracking_type, 'weight_reps') AS tracking_type,
        COALESCE(re.sequence_order, 999) AS sequence_order, 
        re.tags
      FROM set_logs sl
      LEFT JOIN exercises e ON sl.exercise_id = e.id 
      JOIN workout_logs wl ON sl.workout_log_id = wl.id 
      LEFT JOIN routine_exercises re ON re.routine_id = wl.routine_id AND re.exercise_id = sl.exercise_id 
      WHERE sl.workout_log_id = $1
      ORDER BY COALESCE(re.sequence_order, 999) ASC, sl.set_number ASC, sl.id ASC;
    `;
    const setsResult = await db.query(setsQuery, [id]);

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

// 4. POST /api/v1/workouts/:id/sets - Log a set under a workout session after ownership check
router.post('/:id/sets', auth, async (req, res) => {
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
    // 🛡️ BOLA Protection: Verify the user owns the parent workout log before mutating database records
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found or access unauthorized.' });
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
router.put('/:id/sets/:setId', auth, async (req, res) => {
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
    // 🛡️ BOLA Protection: Verify ownership of the parent resource before making modification
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found or access unauthorized.' });
    }

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
      return res.status(404).json({ error: 'Set log not found under this workout.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Database Error in PUT /api/v1/workouts/:id/sets/:setId:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 6. DELETE /api/v1/workouts/:id - Delete a single workout session and child sets
router.delete('/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    // 🛡️ BOLA Protection: Verify ownership before initiating cascade deletions
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found or access unauthorized.' });
    }

    // 1. Clear dependent sets
    await db.query('DELETE FROM set_logs WHERE workout_log_id = $1;', [id]);

    // 2. Clear parent entry
    const result = await db.query('DELETE FROM workout_logs WHERE id = $1 RETURNING *;', [id]);

    return res.status(200).json({ 
      message: 'Workout log and all associated set logs deleted successfully.',
      deletedWorkout: result.rows[0] 
    });
  } catch (error) {
    console.error(`Database Error in DELETE /api/v1/workouts/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 7. PATCH /api/v1/workouts/:id - Update workout session execution details
router.patch('/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { duration_seconds } = req.body;

  try {
    // 🔒 Enforce ID + Owner parameter check directly within the targeting update block
    const queryText = `
      UPDATE workout_logs 
      SET 
        duration_seconds = $1,
        completed_at = NOW()
      WHERE id = $2 AND user_id = $3
      RETURNING *;
    `;
    
    const result = await db.query(queryText, [
      duration_seconds !== undefined ? Number(duration_seconds) : null, 
      id,
      req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found or access unauthorized.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error(`Database Error in PATCH /api/v1/workouts/${id}:`, error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

// 8. DELETE /api/v1/workouts/:id/sets/:setId - Delete a specific set from a workout
router.delete('/:id/sets/:setId', auth, async (req, res) => {
  const { id, setId } = req.params;

  try {
    // 🛡️ BOLA Protection: Verify ownership of the base routine before deleting subcomponents
    const workoutCheck = await db.query('SELECT id FROM workout_logs WHERE id = $1 AND user_id = $2;', [id, req.user.id]);
    if (workoutCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Workout log not found or access unauthorized.' });
    }

    const queryText = `
      DELETE FROM set_logs 
      WHERE id = $1 AND workout_log_id = $2 
      RETURNING *;
    `;
    const result = await db.query(queryText, [setId, id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Set log target reference not found.' });
    }

    return res.status(200).json({ 
      message: 'Set deleted successfully', 
      deletedSet: result.rows[0] 
    });
  } catch (error) {
    console.error('Database Error in DELETE /api/v1/workouts/:id/sets/:setId:', error);
    return res.status(500).json({ error: 'Internal Server Error.' });
  }
});

module.exports = router;