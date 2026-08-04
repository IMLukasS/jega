const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// GET /api/v1/routines
router.get('/', auth, async (req, res) => {
  try {
    const query = `
      SELECT 
        r.id, 
        r.name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rb.id,
              'block_type', rb.block_type,
              'rounds', rb.rounds,
              'round_rest_seconds', rb.round_rest_seconds,
              'auto_advance_round', rb.auto_advance_round,
              'exercises', (
                SELECT json_agg(
                  json_build_object(
                    'id', rbe.id,
                    'exercise_id', e.id,
                    'name', e.title,
                    'tracking_type', COALESCE(rbe.tracking_type_override, e.tracking_type),
                    'tags', rbe.tags,
                    'sets', rbe.sets,
                    'rest_seconds', rbe.rest_seconds,
                    'auto_advance', rbe.auto_advance,
                    'work_seconds', rbe.work_seconds,
                    'timer_mode', rbe.timer_mode
                  ) ORDER BY rbe.sequence_order ASC
                )
                FROM routine_block_exercises rbe
                JOIN exercises e ON rbe.exercise_id = e.id
                WHERE rbe.block_id = rb.id
              )
            ) ORDER BY rb.sequence_order ASC
          ),
          '[]'::json
        ) AS blocks
      FROM routines r
      LEFT JOIN routine_blocks rb ON r.id = rb.routine_id
      WHERE r.user_id = $1
      GROUP BY r.id, r.name, r.display_order, r.created_at
      ORDER BY r.display_order ASC, r.created_at ASC;
    `;

    const result = await db.query(query, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching routines:', error);
    res.status(500).json({ error: 'Failed to fetch routines' });
  }
});

// GET /api/v1/routines/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const routineId = req.params.id;
    const query = `
      SELECT 
        r.id, 
        r.name,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rb.id,
              'block_type', rb.block_type,
              'rounds', rb.rounds,
              'round_rest_seconds', rb.round_rest_seconds,
              'auto_advance_round', rb.auto_advance_round,
              'exercises', (
                SELECT json_agg(
                  json_build_object(
                    'id', rbe.id,
                    'exercise_id', e.id,
                    'name', e.title,
                    'tracking_type', COALESCE(rbe.tracking_type_override, e.tracking_type),
                    'tags', rbe.tags,
                    'sets', rbe.sets,
                    'rest_seconds', rbe.rest_seconds,
                    'auto_advance', rbe.auto_advance,
                    'work_seconds', rbe.work_seconds,
                    'timer_mode', rbe.timer_mode
                  ) ORDER BY rbe.sequence_order ASC
                )
                FROM routine_block_exercises rbe
                JOIN exercises e ON rbe.exercise_id = e.id
                WHERE rbe.block_id = rb.id
              )
            ) ORDER BY rb.sequence_order ASC
          ),
          '[]'::json
        ) AS blocks
      FROM routines r
      LEFT JOIN routine_blocks rb ON r.id = rb.routine_id
      WHERE r.id = $1 AND r.user_id = $2
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
router.post('/', auth, async (req, res) => {
  const { name, blocks } = req.body;

  if (!name || !blocks || blocks.length === 0) {
    return res.status(400).json({ error: 'Routine name and at least one block are required.' });
  }

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const maxOrderResult = await client.query(
      'SELECT COALESCE(MAX(display_order), 0) as max_order FROM routines WHERE user_id = $1',
      [req.user.id]
    );
    const nextOrder = maxOrderResult.rows[0].max_order + 1;

    const routineResult = await client.query(
      'INSERT INTO routines (name, user_id, display_order) VALUES ($1, $2, $3) RETURNING id, name;',
      [name, req.user.id, nextOrder]
    );
    const newRoutine = routineResult.rows[0];

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const blockResult = await client.query(
        'INSERT INTO routine_blocks (routine_id, sequence_order, block_type, rounds, round_rest_seconds, auto_advance_round) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;',
        [newRoutine.id, bi + 1, block.block_type || 'single', block.rounds || 1, block.round_rest_seconds || 0, block.auto_advance_round || false]
      );
      const blockId = blockResult.rows[0].id;

      const exercises = block.exercises || [];
      for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei];
        let finalExerciseId = ex.exercise_id;

        if (!finalExerciseId) {
          const checkExisting = await client.query('SELECT id FROM exercises WHERE LOWER(title) = LOWER($1);', [ex.name.trim()]);
          finalExerciseId = checkExisting.rows.length > 0 ? checkExisting.rows[0].id : null;
          if (!finalExerciseId) {
            const insertNew = await client.query('INSERT INTO exercises (title, tracking_type) VALUES ($1, $2) RETURNING id;', [ex.name.trim(), ex.tracking_type || 'weight_reps']);
            finalExerciseId = insertNew.rows[0].id;
          }
        }

        if (finalExerciseId && ex.tracking_type) {
          await client.query('UPDATE exercises SET tracking_type = $1 WHERE id = $2;', [ex.tracking_type, finalExerciseId]);
        }

        await client.query(
          'INSERT INTO routine_block_exercises (block_id, exercise_id, sequence_order, work_seconds, rest_seconds, auto_advance, tags, sets, tracking_type_override, timer_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
          [blockId, finalExerciseId, ei + 1, ex.work_seconds || null, ex.rest_seconds ?? 90, ex.auto_advance || false, ex.tags || [], JSON.stringify(ex.sets || []), ex.tracking_type || null, ex.timer_mode || 'manual']
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Template created successfully!', routine: newRoutine });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction Error in POST /api/v1/routines:', error);
    res.status(500).json({ error: 'Failed to create template' });
  } finally {
    client.release();
  }
});

// PUT /api/v1/routines/reorder (unchanged)
router.put('/reorder', auth, async (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds array is required.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (let i = 0; i < orderedIds.length; i++) {
      await client.query('UPDATE routines SET display_order = $1 WHERE id = $2 AND user_id = $3', [i, orderedIds[i], req.user.id]);
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
router.put('/:id', auth, async (req, res) => {
  const routineId = req.params.id;
  const { name, blocks } = req.body;
  if (!name || !blocks || blocks.length === 0) return res.status(400).json({ error: 'Routine name and at least one block are required.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const routineResult = await client.query('UPDATE routines SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name;', [name, routineId, req.user.id]);
    if (routineResult.rows.length === 0) return res.status(404).json({ error: 'Routine not found or access unauthorized.' });

    await client.query('DELETE FROM routine_blocks WHERE routine_id = $1', [routineId]);

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const blockResult = await client.query(
        'INSERT INTO routine_blocks (routine_id, sequence_order, block_type, rounds, round_rest_seconds, auto_advance_round) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;',
        [routineId, bi + 1, block.block_type || 'single', block.rounds || 1, block.round_rest_seconds || 0, block.auto_advance_round || false]
      );
      const blockId = blockResult.rows[0].id;

      const exercises = block.exercises || [];
      for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei];
        let finalExerciseId = ex.exercise_id || ex.id;
        if (!finalExerciseId) {
          const checkExisting = await client.query('SELECT id FROM exercises WHERE LOWER(title) = LOWER($1);', [ex.name.trim()]);
          finalExerciseId = checkExisting.rows.length > 0 ? checkExisting.rows[0].id : null;
          if (!finalExerciseId) {
            const insertNew = await client.query('INSERT INTO exercises (title, tracking_type) VALUES ($1, $2) RETURNING id;', [ex.name.trim(), ex.tracking_type || 'weight_reps']);
            finalExerciseId = insertNew.rows[0].id;
          }
        }

        if (finalExerciseId && ex.tracking_type) {
          await client.query('UPDATE exercises SET tracking_type = $1 WHERE id = $2;', [ex.tracking_type, finalExerciseId]);
        }

        await client.query(
          'INSERT INTO routine_block_exercises (block_id, exercise_id, sequence_order, work_seconds, rest_seconds, auto_advance, tags, sets, tracking_type_override, timer_mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);',
          [blockId, finalExerciseId, ei + 1, ex.work_seconds || null, ex.rest_seconds ?? 90, ex.auto_advance || false, ex.tags || [], JSON.stringify(ex.sets || []), ex.tracking_type || null, ex.timer_mode || 'manual']
        );
      }
    }

    await client.query('COMMIT');
    res.status(200).json({ message: 'Template updated successfully!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction Error in PUT /api/v1/routines:', error);
    res.status(500).json({ error: 'Failed to update template' });
  } finally {
    client.release();
  }
});

// DELETE /api/v1/routines/:id
router.delete('/:id', auth, async (req, res) => {
  const routineId = req.params.id;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const checkOwnership = await client.query('SELECT id FROM routines WHERE id = $1 AND user_id = $2', [routineId, req.user.id]);
    if (checkOwnership.rows.length === 0) return res.status(404).json({ error: 'Routine not found or access unauthorized.' });
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