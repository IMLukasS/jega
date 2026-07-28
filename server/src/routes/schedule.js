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

// 🛠️ HELPER: Add days to an ISO string ('YYYY-MM-DD') without relying on server system clock
function addDaysToDateString(dateStr, days = 30) {
  const d = parseLocalDateString(dateStr);
  d.setDate(d.getDate() + days);
  return getLocalDateString(d);
}

// 🔄 HELPER: Forward-Only Calendar Generator & Rollover Engine
async function syncUserSchedule(userId, startDateStr, endDateStr, clientTodayStr) {
  if (!userId) return;

  try {
    const todayStr = clientTodayStr || getLocalDateString();
    const reqStart = startDateStr || todayStr;
    const genStart = reqStart < todayStr ? todayStr : reqStart;
    
    // 💡 FIX: Ensure template generation projects AT LEAST 30 days ahead from todayStr.
    // Even if the UI calendar request passes a shorter endDateStr (e.g. 7-10 days),
    // we must generate future slots so the cascade queue has room to fit moved workouts.
    const defaultEnd = addDaysToDateString(todayStr, 30);
    const genEnd = (endDateStr && endDateStr > defaultEnd) ? endDateStr : defaultEnd;

    // 1. BATCH INSERT missing dates using PostgreSQL generate_series
    await db.query(
      `INSERT INTO scheduled_workouts (user_id, routine_id, scheduled_date, time_slot, activity_type, title, status)
       SELECT 
         $1::uuid,
         wst.routine_id,
         d.day::date,
         COALESCE(wst.time_slot, 'AM'),
         COALESCE(wst.activity_type, 'lifting'),
         COALESCE(wst.title, 'Workout'),
         'pending'
       FROM generate_series($2::date, $3::date, '1 day'::interval) d(day)
       JOIN weekly_schedule_templates wst 
         ON wst.user_id = $1::uuid 
        AND wst.day_of_week = EXTRACT(DOW FROM d.day)::integer
       WHERE NOT EXISTS (
         SELECT 1 FROM scheduled_workouts sw 
         WHERE sw.user_id = $1::uuid 
           AND sw.scheduled_date = d.day::date 
           AND sw.time_slot = COALESCE(wst.time_slot, 'AM')
       )`,
      [userId, genStart, genEnd]
    );

    // 2. Fetch past pending workouts (< Today) for Rollover Engine
    const userRes = await db.query('SELECT scheduling_mode FROM users WHERE id = $1::uuid', [userId]);
    const mode = userRes.rows[0]?.scheduling_mode || 'CONSTRAINED';

    const missedRes = await db.query(
      `SELECT * FROM scheduled_workouts 
       WHERE user_id = $1::uuid AND scheduled_date < $2::date AND status = 'pending'
       ORDER BY scheduled_date ASC`,
      [userId, todayStr]
    );
    const missedWorkouts = missedRes.rows || [];

    if (missedWorkouts.length === 0) return;

    // 3. Apply Rollover
    if (mode === 'STATIC') {
      await db.query(
        `UPDATE scheduled_workouts 
         SET status = 'skipped', updated_at = NOW() 
         WHERE user_id = $1::uuid AND scheduled_date < $2::date AND status = 'pending'`,
        [userId, todayStr]
      );
    } else if (mode === 'PIPELINE') {
      for (const missed of missedWorkouts) {
        await db.query(
          `UPDATE scheduled_workouts SET scheduled_date = $1::date, updated_at = NOW() WHERE id = $2`,
          [todayStr, missed.id]
        );
      }
    } else if (mode === 'CONSTRAINED') {
      // 1. NON-LIFTING (Swim, Cardio, Rest, etc.) -> Stay Static & Mark Skipped
      await db.query(
        `UPDATE scheduled_workouts 
         SET status = 'skipped', updated_at = NOW() 
         WHERE user_id = $1::uuid 
           AND scheduled_date < $2::date 
           AND status = 'pending' 
           AND activity_type != 'lifting'`,
        [userId, todayStr]
      );

      // 2. LIFTING WORKOUTS -> Domino Cascade Shift across future lifting slots
      const missedLiftingRes = await db.query(
        `SELECT id, routine_id, title 
         FROM scheduled_workouts 
         WHERE user_id = $1::uuid 
           AND scheduled_date < $2::date 
           AND status = 'pending' 
           AND activity_type = 'lifting'
         ORDER BY scheduled_date ASC, time_slot ASC`,
        [userId, todayStr]
      );
      const missedLifting = missedLiftingRes.rows || [];

      if (missedLifting.length > 0) {
        // Get all future pending lifting slots starting TODAY (inclusive)
        const futureLiftingRes = await db.query(
          `SELECT id, routine_id, title 
           FROM scheduled_workouts 
           WHERE user_id = $1::uuid 
             AND scheduled_date >= $2::date 
             AND status = 'pending' 
             AND activity_type = 'lifting'
           ORDER BY scheduled_date ASC, time_slot ASC`,
          [userId, todayStr]
        );
        const futureSlots = futureLiftingRes.rows || [];

        // Create the combined sequence: [Missed Lifting Workouts] + [Future Lifting Workouts]
        const fullQueue = [
          ...missedLifting.map(m => ({ routine_id: m.routine_id, title: m.title })),
          ...futureSlots.map(f => ({ routine_id: f.routine_id, title: f.title }))
        ];

        // 🔍 DEBUG LOG: Inspect queue before performing updates
        console.log('🔍 CONSTRAINED Lifting Cascade:', {
          todayStr,
          missedLiftingCount: missedLifting.length,
          futureSlotsFound: futureSlots.length,
          fullQueueTitles: fullQueue.map(q => q.title)
        });

        // Shift the entire sequence into the future lifting slots
        for (let i = 0; i < futureSlots.length; i++) {
          const slot = futureSlots[i];
          const workoutToAssign = fullQueue[i];

          if (workoutToAssign) {
            await db.query(
              `UPDATE scheduled_workouts 
               SET routine_id = $1::uuid, title = $2::varchar, updated_at = NOW() 
               WHERE id = $3`,
              [sanitizeUuid(workoutToAssign.routine_id), workoutToAssign.title, slot.id]
            );
          }
        }

        // Mark the past missed lifting slots as 'skipped'
        const missedIds = missedLifting.map(m => m.id);
        await db.query(
          `UPDATE scheduled_workouts 
           SET status = 'skipped', updated_at = NOW() 
           WHERE id = ANY($1::int[])`,
          [missedIds]
        );
      }
    }
  } catch (err) {
    console.error('❌ Error inside syncUserSchedule engine:', err);
  }
}

// 1. GET /api/v1/schedule/preferences
router.get('/preferences', auth, async (req, res) => {
  const userId = getUserId(req);
  try {
    const userResult = await db.query(
      'SELECT scheduling_mode FROM users WHERE id = $1::uuid',
      [userId]
    );

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
      await client.query(
        'UPDATE users SET scheduling_mode = $1::varchar WHERE id = $2::uuid',
        [scheduling_mode, userId]
      );
    }

    if (Array.isArray(weekly_split)) {
      await client.query(
        'DELETE FROM weekly_schedule_templates WHERE user_id = $1::uuid',
        [userId]
      );

      const todayStr = req.query.today || getLocalDateString();

      // Wipe ONLY pending workouts from TODAY onwards
      await client.query(
        `DELETE FROM scheduled_workouts 
         WHERE user_id = $1::uuid 
           AND scheduled_date >= $2::date 
           AND status = 'pending'`,
        [userId, todayStr]
      );

      const insertQuery = `
        INSERT INTO weekly_schedule_templates (user_id, day_of_week, time_slot, activity_type, routine_id, title)
        VALUES ($1::uuid, $2::integer, $3::varchar, $4::varchar, $5::uuid, $6::varchar)
      `;

      for (const slot of weekly_split) {
        await client.query(insertQuery, [
          userId,
          slot.day_of_week,
          slot.time_slot || 'AM',
          slot.activity_type || 'lifting',
          sanitizeUuid(slot.routine_id),
          slot.title || 'Workout'
        ]);
      }
    }

    await client.query('COMMIT');

    const todayStr = req.query.today || getLocalDateString();
    // 💡 FIX 2: Use virtual todayStr anchor
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
    
    // 💡 FIX 3: Default endDate anchored to clientToday, NOT real system clock
    const endDate = end_date || addDaysToDateString(clientToday, 30);

    await syncUserSchedule(userId, startDate, endDate, clientToday);

    const query = `
      SELECT 
        sw.id,
        sw.user_id,
        sw.routine_id,
        sw.scheduled_date::text AS scheduled_date,
        sw.time_slot,
        sw.activity_type,
        sw.title,
        sw.status,
        sw.created_at,
        sw.updated_at,
        r.name as routine_name
      FROM scheduled_workouts sw
      LEFT JOIN routines r ON sw.routine_id = r.id
      WHERE sw.user_id = $1::uuid 
        AND sw.scheduled_date BETWEEN $2::date AND $3::date
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

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const swRes = await client.query(
      `SELECT title, scheduled_date FROM scheduled_workouts WHERE id = $1 AND user_id = $2::uuid`,
      [scheduledWorkoutId, userId]
    );

    if (swRes.rows.length === 0) {
      throw new Error('Scheduled workout not found');
    }

    const { title, scheduled_date } = swRes.rows[0];
    const targetDateStr = completed_date || getLocalDateString(scheduled_date);
    const durationSeconds = (duration_minutes || 0) * 60;

    await client.query(
      `UPDATE scheduled_workouts 
       SET status = 'completed', completed_at = NOW(), updated_at = NOW() 
       WHERE id = $1`,
      [scheduledWorkoutId]
    );

    await client.query(
      `INSERT INTO workout_logs (user_id, name, started_at, duration_seconds, notes)
       VALUES ($1::uuid, $2::varchar, $3::timestamp, $4::integer, $5::text)`,
      [
        userId, 
        title, 
        `${targetDateStr} 12:00:00`,
        durationSeconds, 
        notes || null
      ]
    );

    await client.query('COMMIT');
    res.json({ message: 'Workout marked as completed!' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error completing workout:', error);
    res.status(500).json({ error: error.message || 'Failed to complete workout' });
  } finally {
    client.release();
  }
});

module.exports = router;