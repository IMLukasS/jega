const express = require('express');
const router = express.Router();

// Adjust these two imports to match your actual project structure.
const db = require('../db');
const auth = require('../middleware/auth');
router.use(auth);

/**
 * GET /exercises/priority?q=<search>
 *
 * The "priority pile" — exercises this user has actually used before,
 * whether it's a custom exercise they made or one pulled from the general
 * library. This is what feeds the autocomplete textbox. Optional `q`
 * narrows by title as the user types.
 */
router.get('/priority', async (req, res, next) => {
  try {
    const { q } = req.query;
    const params = [req.user.id];
    let filter = '';

    if (q && q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      filter = `AND lower(e.title) LIKE $${params.length}`;
    }

    const { rows } = await db.query(
      `
      SELECT e.id, e.title, e.body_part, e.equipment, e.tracking_type,
             (e.user_id IS NOT NULL) AS is_custom,
             ue.last_used_at, ue.use_count
      FROM user_exercises ue
      JOIN exercises e ON e.id = ue.exercise_id
      WHERE ue.user_id = $1
      ${filter}
      ORDER BY ue.last_used_at DESC
      LIMIT 50
      `,
      params
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /exercises/library?scope=mine|all
 *
 * Powers the two tabs in the library modal.
 *   scope=mine -> exercises this user authored
 *   scope=all  -> public library + this user's own (default)
 */
router.get('/library', async (req, res, next) => {
  try {
    const scope = req.query.scope === 'mine' ? 'mine' : 'all';
    const whereClause =
      scope === 'mine' ? 'e.user_id = $1' : '(e.user_id IS NULL OR e.user_id = $1)';

    const { rows } = await db.query(
      `
      SELECT e.id, e.title, e.body_part, e.equipment, e.tracking_type,
             (e.user_id IS NOT NULL) AS is_custom
      FROM exercises e
      WHERE ${whereClause}
      ORDER BY e.title ASC
      `,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /exercises
 * Body: { title: string }
 *
 * Creates a custom exercise for the current user — unless a matching
 * exercise (case-insensitive) already exists in the library or their own
 * customs. In that case the existing exercise is returned instead
 * (matched: true), so usage history doesn't fragment across duplicates
 * like "Bench Press" / "bench press".
 */
router.post('/', async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    const trimmedTitle = title.trim();

    const existing = await db.query(
      `
      SELECT id, title, body_part, equipment, tracking_type, (user_id IS NOT NULL) AS is_custom
      FROM exercises
      WHERE lower(title) = lower($1) AND (user_id IS NULL OR user_id = $2)
      LIMIT 1
      `,
      [trimmedTitle, req.user.id]
    );

    if (existing.rows.length > 0) {
      await trackUsage(req.user.id, existing.rows[0].id);
      return res.status(200).json({ ...existing.rows[0], matched: true });
    }

    const inserted = await db.query(
      `
      INSERT INTO exercises (title, user_id)
      VALUES ($1, $2)
      RETURNING id, title, body_part, equipment, tracking_type, (user_id IS NOT NULL) AS is_custom
      `,
      [trimmedTitle, req.user.id]
    );

    const exercise = inserted.rows[0];
    await trackUsage(req.user.id, exercise.id);
    res.status(201).json({ ...exercise, matched: false });
  } catch (err) {
    if (err.code === '23505') {
      // Race condition between the check above and the insert (two
      // requests creating the same title at once). Treat as a conflict
      // rather than a server error.
      return res.status(409).json({ error: 'An exercise with this name already exists.' });
    }
    next(err);
  }
});

/**
 * POST /exercises/:id/track-usage
 *
 * Call this whenever an exercise is actually used — added to a template,
 * logged in a freestyle workout — not merely browsed in the library
 * modal. Upserts the priority pile.
 */
router.post('/:id/track-usage', async (req, res, next) => {
  try {
    await trackUsage(req.user.id, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

async function trackUsage(userId, exerciseId) {
  await db.query(
    `
    INSERT INTO user_exercises (user_id, exercise_id, use_count, last_used_at)
    VALUES ($1, $2, 1, now())
    ON CONFLICT (user_id, exercise_id)
    DO UPDATE SET use_count = user_exercises.use_count + 1, last_used_at = now()
    `,
    [userId, exerciseId]
  );
}

module.exports = router;