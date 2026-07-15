const express = require('express');
const router = express.Router();
const db = require('../db'); 

// GET /api/v1/routines
// Fetches all routines and bundles their exercises with the new JSON arrays
router.get('/', async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id, 
        r.name,
        json_agg(
          json_build_object(
            'exercise_id', e.id,
            'name', e.title,
            'sequence_order', re.sequence_order,
            'tracking_type', e.tracking_type, -- ---> NEW: Fetches how to track it
            'tags', re.tags,                  -- ---> NEW: Fetches custom tags
            'sets', re.sets,                  -- ---> NEW: Fetches the detailed set array
            'short_description', e.short_description
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

// POST /api/v1/routines
// Creates a new custom template with dynamic set mapping
router.post('/', async (req, res) => {
  const { name, exercises } = req.body;

  if (!name || !exercises || exercises.length === 0) {
    return res.status(400).json({ error: 'Routine name and at least one exercise are required.' });
  }

  const client = await db.connect(); 

  try {
    await client.query('BEGIN'); 

    // 1. Insert the parent routine
    const routineQuery = `
      INSERT INTO routines (name) 
      VALUES ($1) 
      RETURNING id, name;
    `;
    const routineResult = await client.query(routineQuery, [name]);
    const newRoutine = routineResult.rows[0];

    // 2. Prepare the insertion query for the join table
    const routineExerciseQuery = `
      INSERT INTO routine_exercises (routine_id, exercise_id, sequence_order, sets, tags)
      VALUES ($1, $2, $3, $4, $5); 
    `;
    
    // 3. Loop through the exercises array
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      let finalExerciseId = ex.exercise_id;

      // Check if it is a custom exercise
      if (!finalExerciseId) {
        const checkExisting = await client.query(
          'SELECT id FROM exercises WHERE LOWER(title) = LOWER($1);', 
          [ex.name.trim()]
        );

        if (checkExisting.rows.length > 0) {
          finalExerciseId = checkExisting.rows[0].id; 
        } else {
          const insertNewExercise = await client.query(
            'INSERT INTO exercises (title, tracking_type) VALUES ($1, $2) RETURNING id;', 
            [ex.name.trim(), ex.tracking_type || 'weight_reps']
          );
          finalExerciseId = insertNewExercise.rows[0].id; 
        }
      }

      // ---> THE FIX: The Update Logic <---
      // Regardless of whether this exercise was just created or pulled from the library,
      // force the master exercises table to update its tracking_type to match your dropdown!
      if (finalExerciseId) {
        await client.query(
          'UPDATE exercises SET tracking_type = $1 WHERE id = $2;',
          [ex.tracking_type || 'weight_reps', finalExerciseId]
        );
      }

      // 4. Clean up the data for PostgreSQL
      const setsJson = JSON.stringify(ex.sets || []); 
      const tagsArray = ex.tags || [];

      // 5. Insert into the routine_exercises join table
      await client.query(routineExerciseQuery, [
        newRoutine.id, 
        finalExerciseId, 
        i + 1, 
        setsJson, 
        tagsArray 
      ]);
    }

    await client.query('COMMIT'); 
    
    res.status(201).json({ 
      message: 'Template created successfully!', 
      routine: newRoutine 
    });

  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Transaction Error in POST /api/v1/routines:', error);
    
    // ---> THE FIX: Catch the Postgres unique constraint violation (Code 23505) <---
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: `A workout template named "${name}" already exists. Please choose a unique name!` 
      });
    }

    res.status(500).json({ error: 'Failed to create template' });
  } finally {
    client.release();
  }
});

// DELETE /api/v1/routines/:id
// Deletes a template and all its associated exercise links
router.delete('/:id', async (req, res) => {
  const routineId = req.params.id;
  const client = await db.connect(); 

  try {
    await client.query('BEGIN'); 

    // Delete child records first
    await client.query('DELETE FROM routine_exercises WHERE routine_id = $1', [routineId]);
    
    // Delete parent record
    await client.query('DELETE FROM routines WHERE id = $1', [routineId]);

    await client.query('COMMIT'); 
    res.status(200).json({ message: 'Template deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Error deleting routine:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  } finally {
    client.release();
  }
});

module.exports = router;