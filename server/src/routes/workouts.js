const express = require('express');
const router = express.Router();

// Our temporary in-memory relational tables
let workoutsMockDB = [];
let setsMockDB = []; // Mimics our SQL 'set_logs' table

// 1. POST /api/v1/workouts - Create a session
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Workout name is required' });

  const newWorkout = {
    id: Math.random().toString(36).substring(2, 9),
    name: name,
    created_at: new Date().toISOString()
  };

  workoutsMockDB.push(newWorkout);
  return res.status(201).json(newWorkout);
});

// 2. GET /api/v1/workouts - Retrieve all sessions
router.get('/', (req, res) => {
  return res.status(200).json(workoutsMockDB);
});

// 3. GET /api/v1/workouts/:id - Retrieve a single workout WITH its sets
router.get('/:id', (req, res) => {
  const { id } = req.params;
  const workout = workoutsMockDB.find(w => w.id === id);

  if (!workout) {
    return res.status(404).json({ error: `Workout with ID ${id} not found` });
  }

  // Relational Join: Filter out only the sets that belong to this workout ID
  const workoutSets = setsMockDB.filter(set => set.workout_id === id);

  // Spread the workout properties into a new object and attach the sets array
  return res.status(200).json({
    ...workout,
    sets: workoutSets
  });
});

// 4. POST /api/v1/workouts/:id/sets - Log a set for a specific workout
router.post('/:id/sets', (req, res) => {
  const { id } = req.params; // This is the workout_id from the URL
  const { exercise_name, weight, reps, rpe } = req.body;

  // Integrity Check: Does the parent workout actually exist?
  const workoutExists = workoutsMockDB.some(w => w.id === id);
  if (!workoutExists) {
    return res.status(404).json({ error: `Cannot log set. Workout with ID ${id} does not exist.` });
  }

  // Data Validation
  if (!exercise_name || !weight || !reps) {
    return res.status(400).json({ error: 'exercise_name, weight, and reps are required' });
  }

  // Construct the new set record
  const newSet = {
    id: Math.random().toString(36).substring(2, 9),
    workout_id: id, // The "Foreign Key" linking this set to its parent workout
    exercise_name,
    weight: Number(weight),
    reps: Number(reps),
    rpe: rpe ? Number(rpe) : null,
    created_at: new Date().toISOString()
  };

  setsMockDB.push(newSet);
  return res.status(201).json(newSet);
});

module.exports = router;