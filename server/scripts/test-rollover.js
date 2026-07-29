const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const db = require('../src/db');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000/api/v1';

const USER_EMAIL = 'admin@test.com';
const USER_PASSWORD = 'password';
const TEST_MODE = process.env.TEST_MODE || 'CONSTRAINED';

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
// SCENARIO 1: Standard Rollover Test
// ----------------------------------------------------
async function runStandardRolloverTest() {
  console.log(`\n🧪 ==== SCENARIO 1: Standard Rollover — mode=${TEST_MODE} ====\n`);
  await wipeAndSetMode(TEST_MODE);

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES 
      ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending', 'Upper Body A'),
      ($1, '5k Zone 2 Run', 'cardio', '2026-07-28', 'pending', '5k Zone 2 Run'),
      ($1, 'Lap Swimming', 'swim', '2026-07-29', 'pending', 'Lap Swimming')
  `, [userId]);

  const before = await snapshot('BEFORE');
  console.log('\n📅 --- APP OPEN THURSDAY (2026-07-30) ---\n');
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-05`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const after = await snapshot('AFTER');

  console.log('\n🔀 --- DIFF ---');
  const changes = diffSnapshots(before, after);
  changes.length ? console.table(changes) : console.log('⚠️  Nothing changed.');
}

// ----------------------------------------------------
// SCENARIO 2: Double Miss Cascade (CONSTRAINED)
// ----------------------------------------------------
async function runDoubleMissCascadeTest() {
  console.log(`\n🧪 ==== SCENARIO 2: Double Miss Lifting Cascade ====\n`);
  await wipeAndSetMode('CONSTRAINED');

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES 
      ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending', 'Upper Body A'),
      ($1, '5k Zone 2 Run', 'cardio', '2026-07-28', 'pending', '5k Zone 2 Run'),
      ($1, 'Lower Body B', 'lifting', '2026-07-29', 'pending', 'Lower Body B')
  `, [userId]);

  const before = await snapshot('BEFORE');
  console.log('\n📅 --- APP OPEN THURSDAY (2026-07-30) ---\n');
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-12`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const after = await snapshot('AFTER');

  console.log('\n🔀 --- DIFF ---');
  console.table(diffSnapshots(before, after));
}

// ----------------------------------------------------
// SCENARIO 3: Retroactive Completion (basic — no cascade involved)
// ----------------------------------------------------
async function runRetroactiveCompletionTest() {
  console.log(`\n🧪 ==== SCENARIO 3: Basic Retroactive Completion ====\n`);
  await wipeAndSetMode('CONSTRAINED');

  const insertRes = await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending', 'Upper Body A')
    RETURNING id
  `, [userId]);
  const mondayWorkoutId = insertRes.rows[0].id;

  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-05`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`📌 Monday (id ${mondayWorkoutId}) auto-skipped. Posting retroactive completion...`);
  const completeRes = await fetch(`${BASE_URL}/schedule/${mondayWorkoutId}/complete?today=2026-07-30`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_minutes: 45, notes: 'Logged retroactively on Thursday!' })
  });
  console.log('  Response:', (await completeRes.json()).message);

  const checkSw = await db.query(`SELECT id, title, status FROM scheduled_workouts WHERE id = $1`, [mondayWorkoutId]);
  const checkLogs = await db.query(`SELECT name, duration_seconds, notes FROM workout_logs WHERE user_id = $1 ORDER BY id DESC LIMIT 1`, [userId]);
  console.log('\n  Updated Workout Row:', checkSw.rows[0]);
  console.log('  Created Workout Log:', checkLogs.rows[0]);
}

// ----------------------------------------------------
// SCENARIO 4: Retro-Complete UN-SHIFTS a CONSTRAINED cascade
// ----------------------------------------------------
async function runRetroCompleteUndoCascadeTest() {
  console.log(`\n🧪 ==== SCENARIO 4: Retro-Complete Un-Shifts a Cascade ====\n`);
  await wipeAndSetMode('CONSTRAINED');

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES 
      ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending', 'Upper Body A'),
      ($1, '5k Zone 2 Run', 'cardio',  '2026-07-28', 'pending', '5k Zone 2 Run'),
      ($1, 'Lower Body A', 'lifting', '2026-07-29', 'pending', 'Lower Body A'),
      ($1, 'Upper Body B', 'lifting', '2026-07-31', 'pending', 'Upper Body B'),
      ($1, 'Lower Body B', 'lifting', '2026-08-02', 'pending', 'Lower Body B')
  `, [userId]);

  const monId = (await db.query(
    `SELECT id FROM scheduled_workouts WHERE user_id=$1 AND scheduled_date='2026-07-27'`, [userId]
  )).rows[0].id;

  console.log('\n📅 --- APP OPEN THURSDAY (2026-07-30) — Mon & Wed both missed ---\n');
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-12`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const afterCascade = await snapshot('AFTER CASCADE (Mon & Wed both shifted into Fri/Sun)');

  console.log(`\n↺ --- RETRO-COMPLETING MONDAY (id=${monId}) — "I actually did do it" ---\n`);
  const completeRes = await fetch(`${BASE_URL}/schedule/${monId}/complete?today=2026-07-30`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_minutes: 50, notes: 'Actually did this Monday' })
  });
  console.log('  Response:', (await completeRes.json()).message);

  const afterUndo = await snapshot('AFTER RETRO-COMPLETE (should un-shift by one)');

  console.log('\n🔀 --- DIFF: cascade → post-retro-complete ---');
  const changes = diffSnapshots(afterCascade, afterUndo);
  changes.length ? console.table(changes) : console.log('⚠️  Nothing changed — un-shift did not run.');
}

// ----------------------------------------------------
// SCENARIO 5: Double-Complete Prevention
// ----------------------------------------------------
async function runDoubleCompletePreventionTest() {
  console.log(`\n🧪 ==== SCENARIO 5: Double-Complete Prevention ====\n`);
  await wipeAndSetMode('STATIC');

  const insertRes = await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES ($1, 'Evening Swim', 'swim', '2026-07-27', 'pending', 'Evening Swim')
    RETURNING id
  `, [userId]);
  const workoutId = insertRes.rows[0].id;

  const logsBefore = (await db.query(`SELECT COUNT(*) FROM workout_logs WHERE user_id = $1`, [userId])).rows[0].count;

  const first = await fetch(`${BASE_URL}/schedule/${workoutId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_minutes: 30 })
  });
  console.log('  1st call:', first.status, (await first.json()).message);

  const second = await fetch(`${BASE_URL}/schedule/${workoutId}/complete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_minutes: 30 })
  });
  const secondData = await second.json();
  console.log('  2nd call:', second.status, secondData.error);

  const logsAfter = (await db.query(`SELECT COUNT(*) FROM workout_logs WHERE user_id = $1`, [userId])).rows[0].count;
  console.log(`\n  Logs before: ${logsBefore}, after both calls: ${logsAfter}`);
  console.log(second.status === 409 && Number(logsAfter) === Number(logsBefore) + 1
    ? '  ✅ PASS: duplicate blocked, exactly one log created.'
    : '  ❌ FAIL: duplicate was not blocked correctly.');
}

// ----------------------------------------------------
// SCENARIO 6: Single-Day Cascade + Slide-Back
// ----------------------------------------------------
async function runSingleDaySlideBackTest() {
  console.log(`\n🧪 ==== SCENARIO 6: Single-Day Cascade + Slide-Back ====\n`);
  await wipeAndSetMode('CONSTRAINED');

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES 
      ($1, 'Upper Body A', 'lifting', '2026-07-27', 'pending', 'Upper Body A'),
      ($1, 'Lower Body A', 'lifting', '2026-07-28', 'pending', 'Lower Body A')
  `, [userId]);

  const monId = (await db.query(
    `SELECT id FROM scheduled_workouts WHERE user_id=$1 AND scheduled_date='2026-07-27'`, [userId]
  )).rows[0].id;

  console.log('\n📅 --- APP OPEN TUESDAY (2026-07-28) — Monday missed ---\n');
  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-28&start_date=2026-07-27&end_date=2026-08-05`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const afterCascade = await snapshot('AFTER CASCADE', '2026-07-27', '2026-08-05');

  console.log(`\n↺ --- RETRO-COMPLETING MONDAY (id=${monId}) ---\n`);
  const completeRes = await fetch(`${BASE_URL}/schedule/${monId}/complete?today=2026-07-28`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_minutes: 55, notes: 'Actually did Monday after all' })
  });
  console.log('  Response:', (await completeRes.json()).message);

  const afterSlideBack = await snapshot('AFTER RETRO-COMPLETE (should slide back)', '2026-07-27', '2026-08-05');

  console.log('\n🔀 --- DIFF ---');
  console.table(diffSnapshots(afterCascade, afterSlideBack));
}

// ----------------------------------------------------
// SCENARIO 7: Long-Absence Gap Backfill
// ----------------------------------------------------
async function runGapBackfillTest() {
  console.log(`\n🧪 ==== SCENARIO 7: Long-Absence Gap Backfill ====\n`);

  await db.query(`UPDATE users SET scheduling_mode = 'STATIC' WHERE id = $1`, [userId]);
  await db.query(`DELETE FROM scheduled_workouts WHERE user_id = $1`, [userId]);
  await db.query(`DELETE FROM weekly_schedule_templates WHERE user_id = $1`, [userId]);

  await db.query(`
    INSERT INTO weekly_schedule_templates (user_id, day_of_week, time_slot, activity_type, title)
    VALUES ($1, 1, 'AM', 'lifting', 'Leg Day')
  `, [userId]);

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES ($1, 'Leg Day', 'lifting', '2026-07-06', 'completed', 'Leg Day')
  `, [userId]);

  console.log('📌 Last activity: 2026-07-06. Reopening on 2026-08-03 — Mondays 07-13, 07-20, and 07-27 were never generated.\n');

  await fetch(`${BASE_URL}/schedule/calendar?today=2026-08-03`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const rows = await snapshot('AFTER REOPENING ON 2026-08-03', '2026-07-06', '2026-09-02');

  const expectedSkipped = ['2026-07-13', '2026-07-20', '2026-07-27'];
  const gotSkipped = rows.filter(r => r.status === 'skipped').map(r => r.scheduled_date);
  const allFound = expectedSkipped.every(d => gotSkipped.includes(d));

  console.log(allFound
    ? '  ✅ PASS: all 3 gap Mondays exist and are marked skipped — retro-completable.'
    : `  ❌ FAIL: expected ${JSON.stringify(expectedSkipped)}, got ${JSON.stringify(gotSkipped)}`);
}

// ----------------------------------------------------
// SCENARIO 8: Pipeline Domino Shift
// ----------------------------------------------------
async function runPipelineDominoTest() {
  console.log(`\n🧪 ==== SCENARIO 8: Pipeline Mode Domino Shift ====\n`);

  await db.query(`UPDATE users SET scheduling_mode = 'PIPELINE' WHERE id = $1`, [userId]);
  await db.query(`DELETE FROM scheduled_workouts WHERE user_id = $1`, [userId]);
  await db.query(`DELETE FROM weekly_schedule_templates WHERE user_id = $1`, [userId]);

  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES 
      ($1, 'Chest Day A', 'lifting', '2026-07-27', 'pending', 'Chest Day A'),
      ($1, 'Back Day B', 'lifting', '2026-07-28', 'pending', 'Back Day B'),
      ($1, 'Leg Day C', 'lifting', '2026-07-29', 'pending', 'Leg Day C')
  `, [userId]);

  await snapshot('BEFORE (3 Missed Workouts Mon-Wed)', '2026-07-27', '2026-08-02');

  console.log('📅 --- OPENING APP ON THURSDAY (2026-07-30) ---\n');

  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const rows = await snapshot('AFTER PIPELINE DOMINO SHIFT', '2026-07-27', '2026-08-02');

  const chest = rows.find(r => r.title === 'Chest Day A');
  const back = rows.find(r => r.title === 'Back Day B');
  const legs = rows.find(r => r.title === 'Leg Day C');

  const pass = chest?.scheduled_date === '2026-07-30' &&
               back?.scheduled_date === '2026-07-31' &&
               legs?.scheduled_date === '2026-08-01' &&
               rows.every(r => r.status === 'pending');

  console.log(pass
    ? '  ✅ PASS: Chest Day A moved to Thursday, Back B to Friday, Leg C to Saturday. Nothing skipped or stacked!'
    : '  ❌ FAIL: Pipeline workouts did not shift into consecutive forward dates.');
}

// ----------------------------------------------------
// SCENARIO 9: Mid-Month Template Change & History Integrity
// ----------------------------------------------------
async function runTemplateChangeTest() {
  console.log(`\n🧪 ==== SCENARIO 9: Mid-Month Template Update & History Integrity ====\n`);
  await wipeAndSetMode('CONSTRAINED');

  // 1. Mon 07-27 completed, Tue 07-28 skipped
  await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES ($1, 'Old Upper Body A', 'lifting', '2026-07-27', 'completed', 'Old Upper Body A')
  `, [userId]);

  const pastSkipRes = await db.query(`
    INSERT INTO scheduled_workouts (user_id, title, activity_type, scheduled_date, status, original_title)
    VALUES ($1, 'Old Cardio', 'cardio', '2026-07-28', 'skipped', 'Old Cardio')
    RETURNING id
  `, [userId]);
  const skippedId = pastSkipRes.rows[0].id;

  await db.query(`
    INSERT INTO workout_logs (user_id, name, started_at, duration_seconds, notes)
    VALUES ($1, 'Old Upper Body A', '2026-07-27 12:00:00', 3000, 'Original workout log')
  `, [userId]);

  await snapshot('BEFORE TEMPLATE UPDATE (Past History set)', '2026-07-27', '2026-08-05');

  console.log('\n📅 --- USER UPDATES TEMPLATE ON THURSDAY (2026-07-30) ---\n');

  // 2. Mid-month update via API: New split for Mon (Day 1) and Thu (Day 4)
  const newSplit = [
    { day_of_week: 1, time_slot: 'AM', activity_type: 'lifting', title: 'New Push Day' },
    { day_of_week: 4, time_slot: 'AM', activity_type: 'lifting', title: 'New Pull Day' }
  ];

  await fetch(`${BASE_URL}/schedule/preferences?today=2026-07-30`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ scheduling_mode: 'CONSTRAINED', weekly_split: newSplit })
  });

  await fetch(`${BASE_URL}/schedule/calendar?today=2026-07-30&start_date=2026-07-27&end_date=2026-08-05`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  await snapshot('AFTER TEMPLATE UPDATE (Future regenerated)', '2026-07-27', '2026-08-05');

  // 3. Retro-complete old skipped workout after split update
  console.log(`\n↺ --- RETRO-COMPLETING PAST SKIPPED WORKOUT (id=${skippedId}) AFTER TEMPLATE CHANGE ---\n`);
  await fetch(`${BASE_URL}/schedule/${skippedId}/complete?today=2026-07-30`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_minutes: 40, notes: 'Retro-logged after split change' })
  });

  const finalRows = await snapshot('FINAL STATE (Past retro-completed, new split active)', '2026-07-27', '2026-08-05');

  const pastCompRow = finalRows.find(r => r.scheduled_date === '2026-07-27');
  const pastSkipRow = finalRows.find(r => r.scheduled_date === '2026-07-28');
  const futureNewRow = finalRows.find(r => r.scheduled_date === '2026-07-30');

  const pass = pastCompRow?.status === 'completed' && pastCompRow?.title === 'Old Upper Body A' &&
               pastSkipRow?.status === 'completed' && pastSkipRow?.title === 'Old Cardio' &&
               futureNewRow?.title === 'New Pull Day';

  console.log(pass
    ? '  ✅ PASS: History untouched, retro-completion succeeded, and new template applied to future!'
    : '  ❌ FAIL: Mid-month template update corrupted history or failed to apply new split.');
}

async function runAllTests() {
  try {
    await login();
    await runStandardRolloverTest();
    await runDoubleMissCascadeTest();
    await runRetroactiveCompletionTest();
    await runRetroCompleteUndoCascadeTest();
    await runSingleDaySlideBackTest();
    await runGapBackfillTest();
    await runDoubleCompletePreventionTest();
    await runPipelineDominoTest();
    await runTemplateChangeTest();
    console.log('\n✅ ALL SCENARIOS RAN.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test execution failed:', err);
    process.exit(1);
  }
}

runAllTests();