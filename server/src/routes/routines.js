const express = require('express');
const router = express.Router();
const db = require('../db'); 
const auth = require('../middleware/auth'); // 🛡️ Import the security bouncer

// GET /api/v1/routines
// Fetches all routines belonging exclusively to the logged-in user
router.get('/', auth, async (req, res) => {
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
            'tracking_type', e.tracking_type, 
            'tags', re.tags,                  
            'sets', re.sets,                  
            'short_description', e.short_description
          ) ORDER BY re.sequence_order ASC
        ) AS exercises
      FROM routines r
      JOIN routine_exercises re ON r.id = re.routine_id
      JOIN exercises e ON re.exercise_id = e.id
      WHERE r.user_id = $1 -- 🔒 User Isolation Filter
      GROUP BY r.id, r.name, r.display_order, r.created_at
      ORDER BY r.display_order ASC, r.created_at ASC; -- 🔄 Added display_order sorting
    `;
    
    const result = await db.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching routines:', error);
    res.status(500).json({ error: 'Failed to fetch routines' });
  }
});

// GET /api/v1/routines/:id
// Fetches a SINGLE routine, guaranteeing ownership
router.get('/:id', auth, async (req, res) => {
  try {
    const routineId = req.params.id;
    const query = `
      SELECT 
        r.id, 
        r.name,
        json_agg(
          json_build_object(
            'exercise_id', e.id,
            'name', e.title,
            'sequence_order', re.sequence_order,
            'tracking_type', e.tracking_type,
            'tags', re.tags,                  
            'sets', re.sets,                  
            'short_description', e.short_description
          ) ORDER BY re.sequence_order ASC
        ) AS exercises
      FROM routines r
      JOIN routine_exercises re ON r.id = re.routine_id
      JOIN exercises e ON re.exercise_id = e.id
      WHERE r.id = $1 AND r.user_id = $2 -- 🔒 Double validation check (ID + Owner)
      GROUP BY r.id, r.name;
    `;
    
    const result = await db.query(query, [routineId, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Routine not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching single routine:', error);
    res.status(500).json({ error: 'Failed to fetch routine' });
  }
});

// POST /api/v1/routines
// Creates a new custom template bound to the authenticated user's ID
router.post('/', auth, async (req, res) => {
  const { name, exercises } = req.body;

  if (!name || !exercises || exercises.length === 0) {
    return res.status(400).json({ error: 'Routine name and at least one exercise are required.' });
  }

  const client = await db.connect(); 

  try {
    await client.query('BEGIN'); 

    // Find the current max display_order so the new one drops at the bottom of the list
    const maxOrderResult = await client.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM routines WHERE user_id = $1',
      [req.user.id]
    );
    const nextOrder = maxOrderResult.rows[0].max_order + 1;

    // 1. Insert the parent routine mapped to the token's user_id with next available display_order
    const routineQuery = `
      INSERT INTO routines (name, user_id, display_order) 
      VALUES ($1, $2, $3) 
      RETURNING id, name;
    `;
    const routineResult = await client.query(routineQuery, [name, req.user.id, nextOrder]);
    const newRoutine = routineResult.rows[0];

    // 2. Prepare the insertion query for the join table
    const routineExerciseQuery = `
      INSERT INTO routine_exercises (routine_id, exercise_id, sequence_order, sets, tags)
      VALUES ($1, $2, $3, $4, $5); 
    `;
    
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      let finalExerciseId = ex.exercise_id;

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

      if (finalExerciseId) {
        await client.query(
          'UPDATE exercises SET tracking_type = $1 WHERE id = $2;',
          [ex.tracking_type || 'weight_reps', finalExerciseId]
        );
      }

      const setsJson = JSON.stringify(ex.sets || []); 
      const tagsArray = ex.tags || [];

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

// 🔄 PUT /api/v1/routines/reorder
// (MUST go before /:id so Express doesn't treat 'reorder' as a routine ID)
router.put('/reorder', auth, async (req, res) => {
  const { orderedIds } = req.body;

  if (!Array.isArray(orderedIds)) {
    return res.status(400).json({ error: 'orderedIds array is required.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Loop through and update the order for each routine that belongs to this user
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query(
        'UPDATE routines SET display_order = $1 WHERE id = $2 AND user_id = $3',
        [i, orderedIds[i], req.user.id]
      );
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Routines reordered successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering routines:', error);
    res.status(500).json({ error: 'Failed to reorder routines' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/routines/:id
// Updates an existing template if and only if the authenticated user owns it
router.put('/:id', auth, async (req, res) => {
  const routineId = req.params.id;
  const { name, exercises } = req.body;

  if (!name || !exercises || exercises.length === 0) {
    return res.status(400).json({ error: 'Routine name and at least one exercise are required.' });
  }

  const client = await db.connect(); 

  try {
    await client.query('BEGIN'); 

    // 1. Target update explicitly specifying the user_id owner constraint
    const routineResult = await client.query(
      'UPDATE routines SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name;', 
      [name, routineId, req.user.id]
    );

    if (routineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Routine not found or access unauthorized.' });
    }

    // 2. Safely wipe old child exercises from the join table
    await client.query('DELETE FROM routine_exercises WHERE routine_id = $1', [routineId]);

    // 3. Re-insert updated configurations
    const routineExerciseQuery = `
      INSERT INTO routine_exercises (routine_id, exercise_id, sequence_order, sets, tags)
      VALUES ($1, $2, $3, $4, $5); 
    `;
    
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      let finalExerciseId = ex.exercise_id || ex.id; 

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

      if (finalExerciseId) {
        await client.query(
          'UPDATE exercises SET tracking_type = $1 WHERE id = $2;',
          [ex.tracking_type || 'weight_reps', finalExerciseId]
        );
      }

      const setsJson = JSON.stringify(ex.sets || []); 
      const tagsArray = ex.tags || [];

      await client.query(routineExerciseQuery, [
        routineId, 
        finalExerciseId, 
        i + 1, 
        setsJson, 
        tagsArray 
      ]);
    }

    await client.query('COMMIT'); 
    res.status(200).json({ message: 'Template updated successfully!' });

  } catch (error) {
    await client.query('ROLLBACK'); 
    console.error('Transaction Error in PUT /api/v1/routines:', error);
    
    if (error.code === '23505') {
      return res.status(400).json({ error: `A workout template named "${name}" already exists.` });
    }
    res.status(500).json({ error: 'Failed to update template' });
  } finally {
    client.release();
  }
});

// DELETE /api/v1/routines/:id
// Deletes a template and associated exercise references after authenticating ownership
router.delete('/:id', auth, async (req, res) => {
  const routineId = req.params.id;
  const client = await db.connect(); 

  try {
    await client.query('BEGIN'); 

    // Verification step: Ensure the user actually owns this routine before dropping dependencies
    const checkOwnership = await client.query(
      'SELECT id FROM routines WHERE id = $1 AND user_id = $2',
      [routineId, req.user.id]
    );

    if (checkOwnership.rows.length === 0) {
      return res.status(404).json({ error: 'Routine not found or access unauthorized.' });
    }

    // Delete child mapping associations
    await client.query('DELETE FROM routine_exercises WHERE routine_id = $1', [routineId]);
    
    // Delete target parent routine entry
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