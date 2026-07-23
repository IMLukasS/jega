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

// 🔄 HELPER: Forward-Only Calendar Generator & Rollover Engine
async function syncUserSchedule(userId, startDateStr, endDateStr, clientTodayStr) {
  if (!userId) return;

  try {
    const todayStr = clientTodayStr || getLocalDateString();
    const reqStart = startDateStr || todayStr;
    const genStart = reqStart < todayStr ? todayStr : reqStart;
    const genEnd = endDateStr || getLocalDateString(new Date(Date.now() + 30 * 86400000));

    // 🚀 1. BATCH INSERT missing dates using PostgreSQL generate_series in 1 query
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
          `UPDATE scheduled_workouts SET scheduled_date = $1::date, updated_at = NOW() WHERE id = $2::uuid`,
          [todayStr, missed.id]
        );
      }
    } else if (mode === 'CONSTRAINED') {
      for (const missed of missedWorkouts) {
        const nextSlotRes = await db.query(
          `SELECT id, routine_id, title FROM scheduled_workouts 
           WHERE user_id = $1::uuid 
             AND scheduled_date >= $2::date 
             AND activity_type = $3::varchar 
             AND id != $4::uuid
             AND status = 'pending'
           ORDER BY scheduled_date ASC LIMIT 1`,
          [userId, todayStr, missed.activity_type, missed.id]
        );

        if (nextSlotRes.rows.length > 0) {
          const nextSlot = nextSlotRes.rows[0];
          await db.query(
            `UPDATE scheduled_workouts SET routine_id = $1::uuid, title = $2::varchar WHERE id = $3::uuid`,
            [sanitizeUuid(missed.routine_id), missed.title, nextSlot.id]
          );
          await db.query(`UPDATE scheduled_workouts SET status = 'skipped' WHERE id = $1::uuid`, [missed.id]);
        } else {
          await db.query(`UPDATE scheduled_workouts SET scheduled_date = $1::date WHERE id = $2::uuid`, [todayStr, missed.id]);
        }
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

      // 🧹 Wipe ONLY pending workouts from TODAY onwards
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

    const now = new Date();
    const startStr = getLocalDateString(now);
    const endStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const todayStr = req.query.today || getLocalDateString(now);

    await syncUserSchedule(userId, startStr, endStr, todayStr);

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
    const startDate = start_date || getLocalDateString();
    const endDate = end_date || getLocalDateString(new Date(Date.now() + 30 * 86400000));
    const clientToday = today || getLocalDateString();

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

module.exports = router;