const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

const getUserId = (req) => req.user?.id || req.user?.userId;
const sanitizeUuid = (val) => (val && typeof val === 'string' && val.trim() !== '' ? val.trim() : null);

function getLocalDateString(d = new Date()) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDateString(dateStr) {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDaysToDateString(dateStr, days = 30) {
  const d = parseLocalDateString(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

// 🧬 GROUND-TRUTH CASCADE RECOMPUTE (CONSTRAINED, lifting only)
// Idempotent — safe to call from anywhere, any number of times, in any order.
async function recomputeConstrainedLifting(userId, todayStr) {
  const missedRes = await db.query(
    `SELECT id, COALESCE(original_title, title) AS original_title,
            COALESCE(original_routine_id, routine_id) AS original_routine_id
     FROM scheduled_workouts
     WHERE user_id = $1::uuid
       AND activity_type = 'lifting'
       AND status = 'skipped'
       AND scheduled_date < $2::date
     ORDER BY scheduled_date ASC, time_slot ASC`,
    [userId, todayStr]
  );
  const missedLifting = missedRes.rows || [];

  const futureRes = await db.query(
    `SELECT id, COALESCE(original_title, title) AS original_title,
            COALESCE(original_routine_id, routine_id) AS original_routine_id
     FROM scheduled_workouts
     WHERE user_id = $1::uuid
       AND activity_type = 'lifting'
       AND status = 'pending'
       AND scheduled_date >= $2::date
     ORDER BY scheduled_date ASC, time_slot ASC`,
    [userId, todayStr]
  );
  const futureSlots = futureRes.rows || [];

  const queue = [
    ...missedLifting.map(m => ({ title: m.original_title, routine_id: m.original_routine_id })),
    ...futureSlots.map(f => ({ title: f.original_title, routine_id: f.original_routine_id }))
  ];

  for (let i = 0; i < futureSlots.length; i++) {
    const slot = futureSlots[i];
    const content = queue[i];
    await db.query(
      `UPDATE scheduled_workouts SET title = $1::varchar, routine_id = $2::uuid, updated_at = NOW() WHERE id = $3`,
      [content.title, sanitizeUuid(content.routine_id), slot.id]
    );
  }

  const overflowCount = Math.max(0, queue.length - futureSlots.length);
  if (overflowCount > 0) {
    console.warn(`⚠️ [CONSTRAINED] ${overflowCount} workout(s) don't fit in the current window and remain unassigned.`);
  }

  return { movedCount: missedLifting.length, overflowCount };
}

const MAX_BACKFILL_DAYS = 180; // Safety cap to prevent runaway inserts after long absences

// 🔄 HELPER: Forward-Only Calendar Generator & Rollover Engine
async function syncUserSchedule(userId, startDateStr, endDateStr, clientTodayStr) {
  if (!userId) return { executed: false, mode: 'CONSTRAINED', skippedCount: 0, movedCount: 0 };

  try {
    const todayStr = clientTodayStr || getLocalDateString();
    const reqStart = startDateStr || todayStr;
    let genStart = reqStart < todayStr ? todayStr : reqStart;

    // 🩹 GAP-FILL: Resume schedule generation from where it last left off
    const lastGenRes = await db.query(
      `SELECT MAX(scheduled_date)::text AS last_date FROM scheduled_workouts WHERE user_id = $1::uuid`,
      [userId]
    );
    const lastGenDate = lastGenRes.rows[0]?.last_date;

    if (lastGenDate) {
      let gapFillStart = addDaysToDateString(lastGenDate, 1);
      const earliestAllowed = addDaysToDateString(todayStr, -MAX_BACKFILL_DAYS);
      
      if (gapFillStart < earliestAllowed) {
        console.warn(`⚠️ Gap exceeds ${MAX_BACKFILL_DAYS} days — capping backfill start at ${earliestAllowed}.`);
        gapFillStart = earliestAllowed;
      }
      
      if (gapFillStart < genStart) {
        genStart = gapFillStart;
      }
    }

    const defaultEnd = addDaysToDateString(todayStr, 30);
    const genEnd = (endDateStr && endDateStr > defaultEnd) ? endDateStr : defaultEnd;

    // 1. BATCH INSERT missing dates with valid ground truth columns
    await db.query(
      `INSERT INTO scheduled_workouts (
         user_id, routine_id, scheduled_date, time_slot, activity_type, title, status,
         original_title, original_routine_id
       ) 
       SELECT 
         $1::uuid,
         wst.routine_id,
         d.day::date,
         COALESCE(wst.time_slot, 'AM'),
         COALESCE(wst.activity_type, 'lifting'),
         COALESCE(wst.title, 'Workout'),
         'pending',
         COALESCE(wst.title, 'Workout'),
         wst.routine_id
       FROM generate_series($2::date, $3::date, '1 day'::interval) d(day)
       JOIN weekly_schedule_templates wst 
         ON wst.user_id = $1::uuid 
        AND wst.day_of_week = EXTRACT(DOW FROM d.day)::integer
       WHERE NOT EXISTS (
         SELECT 1 FROM scheduled_workouts sw 
         WHERE sw.user_id = $1::uuid 
           AND sw.scheduled_date = d.day::date 
           AND COALESCE(sw.time_slot, 'AM') = COALESCE(wst.time_slot, 'AM')
       )`,
      [userId, genStart, genEnd]
    );

    const userRes = await db.query('SELECT scheduling_mode FROM users WHERE id = $1::uuid', [userId]);
    const mode = userRes.rows[0]?.scheduling_mode || 'CONSTRAINED';

    const missedRes = await db.query(
      `SELECT * FROM scheduled_workouts 
       WHERE user_id = $1::uuid AND scheduled_date < $2::date AND status = 'pending'
       ORDER BY scheduled_date ASC`,
      [userId, todayStr]
    );
    const missedWorkouts = missedRes.rows || [];

    if (missedWorkouts.length === 0) {
      return { executed: false, mode, skippedCount: 0, movedCount: 0 };
    }

    let skippedCount = 0;
    let movedCount = 0;

    if (mode === 'STATIC') {
      const result = await db.query(
        `UPDATE scheduled_workouts 
         SET status = 'skipped', updated_at = NOW() 
         WHERE user_id = $1::uuid AND scheduled_date < $2::date AND status = 'pending'`,
        [userId, todayStr]
      );
      skippedCount = result.rowCount || missedWorkouts.length;

    } else if (mode === 'PIPELINE') {
  // Fetch ALL pending workouts in chronological order
  const allPendingRes = await db.query(
    `SELECT id, scheduled_date::text AS scheduled_date 
     FROM scheduled_workouts 
     WHERE user_id = $1::uuid AND status = 'pending'
     ORDER BY scheduled_date ASC, time_slot ASC`,
    [userId]
  );
  
  const pendingQueue = allPendingRes.rows || [];

  if (pendingQueue.length > 0) {
    let targetDateStr = todayStr;

    for (const workout of pendingQueue) {
      // If a pending workout's date is in the past, push it forward to targetDateStr
      if (workout.scheduled_date < targetDateStr) {
        await db.query(
          `UPDATE scheduled_workouts 
           SET scheduled_date = $1::date, updated_at = NOW() 
           WHERE id = $2`,
          [targetDateStr, workout.id]
        );
        movedCount++;
      } else {
        // Workout is already on or after targetDateStr; advance targetDateStr to this date
        targetDateStr = workout.workout_date || workout.scheduled_date;
      }

      // Advance the target date by 1 day for the next item in line to prevent stacking
      targetDateStr = addDaysToDateString(targetDateStr, 1);
    }
  }
    } else if (mode === 'CONSTRAINED') {
      // Non-lifting: Mark as skipped
      const nonLiftingResult = await db.query(
        `UPDATE scheduled_workouts 
         SET status = 'skipped', updated_at = NOW() 
         WHERE user_id = $1::uuid 
           AND scheduled_date < $2::date 
           AND status = 'pending' 
           AND activity_type != 'lifting'`,
        [userId, todayStr]
      );
      skippedCount = nonLiftingResult.rowCount || 0;

      // Lifting: Mark past pending rows as 'skipped'
      await db.query(
        `UPDATE scheduled_workouts 
         SET status = 'skipped', updated_at = NOW() 
         WHERE user_id = $1::uuid 
           AND scheduled_date < $2::date 
           AND status = 'pending' 
           AND activity_type = 'lifting'`,
        [userId, todayStr]
      );

      // Recompute display sequence downstream
      const { movedCount: cascadeMoved } = await recomputeConstrainedLifting(userId, todayStr);
      movedCount = cascadeMoved;
    }

    return { executed: true, mode, skippedCount, movedCount };

  } catch (err) {
    console.error('❌ Error inside syncUserSchedule engine:', err);
    return { executed: false, mode: 'CONSTRAINED', skippedCount: 0, movedCount: 0 };
  }
}

// 1. GET /api/v1/schedule/preferences
router.get('/preferences', auth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const userResult = await db.query('SELECT scheduling_mode FROM users WHERE id = $1::uuid', [userId]);
    const weeklyResult = await db.query(
      `SELECT wst.id, wst.day_of_week, wst.time_slot, wst.activity_type, wst.routine_id, wst.title, r.name as routine_name
       FROM weekly_schedule_templates wst
       LEFT JOIN routines r ON wst.routine_id = r.id
       WHERE wst.user_id = $1::uuid
       ORDER BY wst.day_of_week ASC, wst.time_slot ASC`,
      [userId]
    );
    res.json({
      scheduling_mode: userResult.rows[0]?.scheduling_mode || 'CONSTRAINED',
      weekly_split: weeklyResult.rows || []
    });
  } catch (error) {
    console.error('❌ Error fetching schedule preferences:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch schedule preferences' });
  }
});

// 2. PUT /api/v1/schedule/preferences
router.put('/preferences', auth, async (req, res) => {
  const userId = getUserId(req);
  const { scheduling_mode, weekly_split } = req.body;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    if (scheduling_mode) {
      await client.query('UPDATE users SET scheduling_mode = $1::varchar WHERE id = $2::uuid', [scheduling_mode, userId]);
    }

    if (Array.isArray(weekly_split)) {
      await client.query('DELETE FROM weekly_schedule_templates WHERE user_id = $1::uuid', [userId]);

      const todayStr = req.query.today || getLocalDateString();

      await client.query(
        `DELETE FROM scheduled_workouts 
         WHERE user_id = $1::uuid AND scheduled_date >= $2::date AND status = 'pending'`,
        [userId, todayStr]
      );

      const insertQuery = `
        INSERT INTO weekly_schedule_templates (user_id, day_of_week, time_slot, activity_type, routine_id, title)
        VALUES ($1::uuid, $2::integer, $3::varchar, $4::varchar, $5::uuid, $6::varchar)
      `;

      for (const slot of weekly_split) {
        await client.query(insertQuery, [
          userId, slot.day_of_week, slot.time_slot || 'AM',
          slot.activity_type || 'lifting', sanitizeUuid(slot.routine_id), slot.title || 'Workout'
        ]);
      }
    }

    await client.query('COMMIT');

    const todayStr = req.query.today || getLocalDateString();
    const endStr = addDaysToDateString(todayStr, 30);
    await syncUserSchedule(userId, todayStr, endStr, todayStr);

    res.json({ message: 'Schedule preferences updated successfully!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error updating schedule preferences:', error);
    res.status(500).json({ error: error.message || 'Failed to update schedule preferences' });
  } finally {
    client.release();
  }
});

// 3. GET /api/v1/schedule/calendar
router.get('/calendar', auth, async (req, res) => {
  const userId = getUserId(req);
  const { start_date, end_date, today } = req.query;

  try {
    const clientToday = today || getLocalDateString();
    const startDate = start_date || clientToday;
    const endDate = end_date || addDaysToDateString(clientToday, 30);

    const rolloverSummary = await syncUserSchedule(userId, startDate, endDate, clientToday);

    const query = `
      SELECT 
        sw.id, sw.user_id, sw.routine_id, sw.scheduled_date::text AS scheduled_date,
        sw.time_slot, sw.activity_type, sw.title, sw.status, sw.created_at, sw.updated_at,
        r.name as routine_name
      FROM scheduled_workouts sw
      LEFT JOIN routines r ON sw.routine_id = r.id
      WHERE sw.user_id = $1::uuid AND sw.scheduled_date BETWEEN $2::date AND $3::date
      ORDER BY sw.scheduled_date ASC, sw.time_slot ASC
    `;

    const result = await db.query(query, [userId, startDate, endDate]);
    res.json(result.rows || []);
  } catch (error) {
    console.error('❌ Error fetching calendar workouts:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch calendar workouts' });
  }
});

// 4. POST /api/v1/schedule/:id/complete (Quick Complete & Retroactive)
router.post('/:id/complete', auth, async (req, res) => {
  const userId = getUserId(req);
  const scheduledWorkoutId = req.params.id;
  const { duration_minutes, notes, completed_date } = req.body;
  const todayStr = req.query.today || req.body.today || getLocalDateString();

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const swRes = await client.query(
      `SELECT title, scheduled_date, status, activity_type FROM scheduled_workouts WHERE id = $1 AND user_id = $2::uuid`,
      [scheduledWorkoutId, userId]
    );

    if (swRes.rows.length === 0) {
      throw new Error('Scheduled workout not found');
    }

    const { title, scheduled_date, status, activity_type } = swRes.rows[0];

    if (status === 'completed') {
      throw new Error('ALREADY_COMPLETED');
    }

    const targetDateStr = completed_date || getLocalDateString(scheduled_date);
    const durationSeconds = (duration_minutes || 0) * 60;

    await client.query(
      `UPDATE scheduled_workouts SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [scheduledWorkoutId]
    );

    await client.query(
      `INSERT INTO workout_logs (user_id, name, started_at, duration_seconds, notes)
       VALUES ($1::uuid, $2::varchar, $3::timestamp, $4::integer, $5::text)`,
      [userId, title, `${targetDateStr} 12:00:00`, durationSeconds, notes || null]
    );

    await client.query('COMMIT');

    if (activity_type === 'lifting') {
      const modeRes = await db.query('SELECT scheduling_mode FROM users WHERE id = $1::uuid', [userId]);
      if (modeRes.rows[0]?.scheduling_mode === 'CONSTRAINED') {
        try {
          await recomputeConstrainedLifting(userId, todayStr);
        } catch (recomputeErr) {
          console.error('⚠️ Completed workout, but cascade recompute failed:', recomputeErr);
        }
      }
    }

    res.json({ message: 'Workout marked as completed!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error completing workout:', error);
    const isDuplicate = error.message === 'ALREADY_COMPLETED';
    res.status(isDuplicate ? 409 : 500).json({
      error: isDuplicate ? 'This workout has already been logged.' : (error.message || 'Failed to complete workout')
    });
  } finally {
    client.release();
  }
});

module.exports = router;