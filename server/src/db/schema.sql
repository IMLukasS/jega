-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
-- Stores account info only — no workout data lives here
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exercises
-- A library of movements — not tied to any user or circuit yet
-- is_custom lets users add their own exercises later
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  muscle_group VARCHAR(50) NOT NULL, -- chest, back, legs, shoulders, arms, core
  equipment VARCHAR(50),             -- barbell, dumbbell, machine, bodyweight
  is_custom BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuits
-- A named collection of exercises belonging to a user
CREATE TABLE circuits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,        -- "Push Day", "Leg Day A"
  description TEXT,
  spotify_playlist_id VARCHAR(255),  -- linked playlist auto-starts on circuit select
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Circuit exercises (junction table)
-- Defines which exercises are in a circuit and in what order
-- Also stores default sets/reps/rest as a starting point
CREATE TABLE circuit_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,         -- order within the circuit
  default_sets INTEGER DEFAULT 3,
  default_reps INTEGER DEFAULT 10,
  default_rest_seconds INTEGER DEFAULT 60,
  UNIQUE(circuit_id, position)       -- no two exercises can share the same position
);

-- Weekly plans
-- The progression engine generates one of these every Sunday per user
CREATE TABLE weekly_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,      -- week 1, 2, 3...
  week_start DATE NOT NULL,          -- actual calendar date the week starts
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, circuit_id, week_number)
);

-- Planned sets
-- The specific weight/reps the engine recommends for each exercise in a weekly plan
CREATE TABLE planned_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  weekly_plan_id UUID NOT NULL REFERENCES weekly_plans(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  target_weight_kg NUMERIC(6,2),
  target_reps INTEGER NOT NULL
);

-- Workout logs
-- Created when a user starts a workout session
CREATE TABLE workout_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  circuit_id UUID NOT NULL REFERENCES circuits(id) ON DELETE CASCADE,
  weekly_plan_id UUID REFERENCES weekly_plans(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT                         -- free text: "felt strong today", "back tight"
);

-- Set logs
-- The actual lifts performed — this is the raw data the progression engine reads
CREATE TABLE set_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workout_log_id UUID NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  actual_weight_kg NUMERIC(6,2),
  actual_reps INTEGER NOT NULL,
  rpe NUMERIC(3,1),                  -- rate of perceived exertion: 1-10, e.g. 7.5
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for the queries we know we'll run constantly
-- Without these, every query scans the entire table row by row
CREATE INDEX idx_circuits_user_id ON circuits(user_id);
CREATE INDEX idx_workout_logs_user_id ON workout_logs(user_id);
CREATE INDEX idx_set_logs_workout_log_id ON set_logs(workout_log_id);
CREATE INDEX idx_set_logs_exercise_id ON set_logs(exercise_id);
CREATE INDEX idx_weekly_plans_user_id ON weekly_plans(user_id);
CREATE INDEX idx_planned_sets_weekly_plan_id ON planned_sets(weekly_plan_id);