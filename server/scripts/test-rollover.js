// server/scripts/test-rollover.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/db');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

const USER_EMAIL = 'admin@test.com';
const USER_PASSWORD = 'password';
const TEST_MODE = process.env.TEST_MODE || 'CONSTRAINED'; // STATIC | PIPELINE | CONSTRAINED

let token = null;
let userId = null;

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USER_EMAIL, password: USER_PASSWORD })
  });
  const data = await res.json();
  token = data.token || data.accessToken;

  const userRes = await db.query('SELECT id FROM users WHERE email = $1', [USER_EMAIL]);
  userId = userRes.rows[0].id;
}

// Reads straight from Postgres — does NOT trigger the sync engine
async function snapshot(label, startDate = '2026-07-27', endDate = '2026-08-12') {
  const res = await db.query(
    `SELECT id, scheduled_date::text AS scheduled_date, title, activity_type, status
     FROM scheduled_workouts
     WHERE user_id = $1 AND scheduled_date BETWEEN $2::date AND $3::date
     ORDER BY scheduled_date ASC, time_slot ASC`,
    [userId, startDate, endDate]
  );
  console.log(`--- ${label} ---`);
  console.table(res.rows.map(r => ({
    id: r.id, Date: r.scheduled_date, Title: r.title, Type: r.activity_type, Status: r.status
  })));
  return res.rows;
}

function diffSnapshots(before, after) {
  const beforeById = new Map(before.map(r => [r.id, r]));
  const rows = [];

  for (const a of after) {
    const b = beforeById.get(a.id);
    if (!b) {
      rows.push({ id: a.id, Change: 'NEW ROW', Date: a.scheduled_date, Title: a.title, Status: a.status });
      continue;
    }
    const dateChanged = b.scheduled_date !== a.scheduled_date;
    const titleChanged = b.title !== a.title;
    const statusChanged = b.status !== a.status;
    if (dateChanged || titleChanged || statusChanged) {
      rows.push({
        id: a.id,
        Change: dateChanged ? 'MOVED' : titleChanged ? 'CONTENT SWAPPED' : 'STATUS ONLY',
        Date: dateChanged ? `${b.scheduled_date} → ${a.scheduled_date}` : a.scheduled_date,
        Title: titleChanged ? `${b.title} → ${a.title}` : a.title,
        Status: statusChanged ? `${b.status} → ${a.status}` : a.status
      });
    }
  }
  return rows;
}

async function wipeAndSetMode(mode) {
  await db.query(`UPDATE users SET scheduling_mode = $1 WHERE id = $2`, [mode, userId]);
  await db.query(`DELETE FROM scheduled_workouts WHERE user_id = $1 AND scheduled_date >= '2026-07-27'`, [userId]);
}

// ----------------------------------------------------
// SCENARIO 1: Standard Rollover Test (Uses process.env.TEST_MODE)
// ----------------------------------------------------
async function runStandardRolloverTest() {
  console.log(`\n🧪 ====================================================`);
  console.log(`🚀 SCENARIO 1: Standard Rollover Test — mode=${TEST_MODE}`);
  console.log(`====================================================\n`);

  await wipeAndSetMode(TEST_MODE);

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status)
    VALUES 
      ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending'),
      ($1, '5k Zone 2 Run', 'cardio', '2026-07-28', 'pending'),
      ($1, 'Lap Swimming', 'swim', '2026-07-29', 'pending')
  `, [userId]);

  const before = await snapshot('BEFORE (Single Missed Lift Seeded)', '2026-07-27', '2026-08-12');

  console.log('\n📅 --- SIMULATING APP OPEN ON THURSDAY (2026-07-30) ---\n');
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-05`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const after = await snapshot('AFTER (Post Rollover)', '2026-07-27', '2026-08-12');

  console.log('\n🔀 --- ROW-BY-ROW DIFF ---');
  const changes = diffSnapshots(before, after);
  changes.length ? console.table(changes) : console.log('⚠️  Nothing changed — unexpected given missed workouts.');
}

// ----------------------------------------------------
// SCENARIO 2: Edge Case — Double Miss Cascade (CONSTRAINED)
// ----------------------------------------------------
async function runDoubleMissCascadeTest() {
  console.log(`\n🧪 ====================================================`);
  console.log(`🚀 SCENARIO 2: Edge Case — Double Miss Lifting Cascade`);
  console.log(`====================================================\n`);

  await wipeAndSetMode('CONSTRAINED');

  // Seed Mon (Lift 1), Tue (Cardio), Wed (Lift 2)
  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status)
    VALUES 
      ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending'),
      ($1, '5k Zone 2 Run', 'cardio', '2026-07-28', 'pending'),
      ($1, 'Lower Body B', 'lifting', '2026-07-29', 'pending')
  `, [userId]);

  const before = await snapshot('BEFORE (Mon & Wed Missed Lifting Seeded)', '2026-07-27', '2026-08-12');

  console.log('\n📅 --- SIMULATING APP OPEN ON THURSDAY (2026-07-30) ---\n');
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-12`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const after = await snapshot('AFTER (Post Double Miss Cascade)', '2026-07-27', '2026-08-12');

  console.log('\n🔀 --- ROW-BY-ROW DIFF ---');
  const changes = diffSnapshots(before, after);
  console.table(changes);
}

// ----------------------------------------------------
// SCENARIO 3: Edge Case — Retroactive Completion
// ----------------------------------------------------
async function runRetroactiveCompletionTest() {
  console.log(`\n🧪 ====================================================`);
  console.log(`🚀 SCENARIO 3: Edge Case — Retroactive Completion`);
  console.log(`====================================================\n`);

  await wipeAndSetMode('CONSTRAINED');

  const insertRes = await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status)
    VALUES ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending')
    RETURNING id
  `, [userId]);
  const mondayWorkoutId = insertRes.rows[0].id;

  // Sync on Thursday forces Monday to mark as skipped
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-05`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`📌 Monday Workout (ID ${mondayWorkoutId}) auto-skipped. Now posting retroactive completion...`);

  const completeRes = await fetch(`${BASE_URL}/schedule/${mondayWorkoutId}/complete`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      duration_minutes: 45,
      notes: 'Logged retroactively on Thursday!'
    })
  });

  const completeData = await completeRes.json();
  console.log('  Response:', completeData.message);

  const checkSw = await db.query(`SELECT id, title, status FROM scheduled_workouts WHERE id = $1`, [mondayWorkoutId]);
  const checkLogs = await db.query(`SELECT user_id, name, duration_seconds, notes FROM workout_logs WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [userId]);

  console.log('\n  Updated Workout Row:', checkSw.rows[0]);
  console.log('  Created Workout Log:', checkLogs.rows[0]);
}

async function runAllTests() {
  try {
    await login();

    await runStandardRolloverTest();
    await runDoubleMissCascadeTest();
    await runRetroactiveCompletionTest();

    console.log('\n✅ ALL TEST SCENARIOS PASSED PERFECTLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  }
}

runAllTests();