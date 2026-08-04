// src/hooks/useWorkoutSession.js
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../apiClient';

export const useWorkoutSession = () => {
  const { routineId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [routine, setRoutine] = useState(null);
  const [workoutId, setWorkoutId] = useState(null);
  const sessionStarted = useRef(false);

  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession && savedSession.startTime) {
      return Math.floor((Date.now() - savedSession.startTime) / 1000);
    }
    return 0;
  });

  const [activeUnitIndex, setActiveUnitIndex] = useState(() => {
    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession?.routineId === routineId && savedSession.activeIndex !== undefined) {
      return savedSession.activeIndex;
    }
    return 0;
  });

  // Derive workout units from routine.blocks (new structure)
  const workoutUnits = routine?.blocks?.map(block => ({
    id: block.id,
    type: block.block_type, // 'single', 'circuit', 'superset'
    exercises: block.exercises,
    rounds: block.rounds,
    roundRest: block.round_rest_seconds,
    autoAdvanceRound: block.auto_advance_round,
  })) ?? [];

  const activeUnit = workoutUnits[activeUnitIndex];
  // For single type, the active exercise is the first (and only) one
  const activeExercise = activeUnit?.exercises?.[0] ?? null;

  // Elapsed timer
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timerInterval);
  }, []);

  // Routine loading + workout creation / resume
  useEffect(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;

    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    const isResuming = savedSession && savedSession.routineId === routineId;

    const freestyleTrackingType = location.state?.freestyleTrackingType || 'weight_reps';

    if (routineId === 'freestyle') {
      // Create mock routine with a single block
      const freestyleMock = {
        name: location.state?.customName || 'Freestyle Workout',
        blocks: [{
          id: 'freestyle-block',
          block_type: 'single',
          exercises: [{
            id: 'c1f00c2b-4ec9-4ccb-8d67-2c52a405a1a7',
            exercise_id: 'c1f00c2b-4ec9-4ccb-8d67-2c52a405a1a7',
            name: 'Freestyle Exercise',
            tracking_type: freestyleTrackingType,
            sets: [],
            rest_seconds: 90,
            auto_advance: false,
            work_seconds: null,
            timer_mode: 'manual',
            tags: []
          }],
          rounds: 1,
          round_rest_seconds: 0,
          auto_advance_round: false,
        }]
      };
      setRoutine(freestyleMock);

      if (isResuming) {
        setWorkoutId(savedSession.workoutId);
      } else if (location.state?.existingWorkoutId) {
        setWorkoutId(location.state.existingWorkoutId);
        localStorage.setItem('activeWorkoutSession', JSON.stringify({
          workoutId: location.state.existingWorkoutId, routineId, startTime: Date.now()
        }));
      } else {
        fetchWithAuth('/api/v1/workouts', {
          method: 'POST',
          body: JSON.stringify({ name: 'Freestyle Session', routine_id: null })
        })
        .then(res => res.json())
        .then(sessionData => {
          setWorkoutId(sessionData.id);
          localStorage.setItem('activeWorkoutSession', JSON.stringify({
            workoutId: sessionData.id, routineId, startTime: Date.now()
          }));
        })
        .catch(err => console.error("Error starting freestyle:", err));
      }
      return;
    }

    // Standard routine
    fetchWithAuth(`/api/v1/routines/${routineId}`)
      .then(res => res.json())
      .then(async data => {
        const selectedRoutine = Array.isArray(data) ? data.find(r => r.id === routineId) : data;
        if (!selectedRoutine) return;
        setRoutine(selectedRoutine);

        if (isResuming) {
          setWorkoutId(savedSession.workoutId);
        } else {
          const startSessionRes = await fetchWithAuth('/api/v1/workouts', {
            method: 'POST',
            body: JSON.stringify({ name: `${selectedRoutine.name} Session`, routine_id: selectedRoutine.id })
          });
          const sessionData = await startSessionRes.json();
          setWorkoutId(sessionData.id);
          localStorage.setItem('activeWorkoutSession', JSON.stringify({
            workoutId: sessionData.id, routineId, startTime: Date.now()
          }));
        }
      });
  }, [routineId, location.state]);

  // Auto-save active index
  useEffect(() => {
    if (!workoutId) return;
    const saved = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (saved) {
      saved.activeIndex = activeUnitIndex;
      localStorage.setItem('activeWorkoutSession', JSON.stringify(saved));
    }
  }, [activeUnitIndex, workoutId]);

  const handleCancelWorkout = async () => {
    const isSure = window.confirm("Are you sure you want to cancel? This will delete the workout entirely.");
    if (!isSure) return;
    localStorage.removeItem('activeWorkoutSession');
    try { await fetchWithAuth(`/api/v1/workouts/${workoutId}`, { method: 'DELETE' }); } catch {}
    navigate('/templates');
  };

  const handleFinalizeWorkout = async () => {
    localStorage.removeItem('activeWorkoutSession');
    try {
      await fetchWithAuth(`/api/v1/workouts/${workoutId}`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: elapsedSeconds })
      });
    } catch (e) { console.error(e); }
    navigate(`/workouts/${workoutId}`);
  };

  return {
    routine,
    workoutId,
    activeUnitIndex,
    setActiveUnitIndex,
    activeUnit,
    activeExercise,
    workoutUnits,
    elapsedSeconds,
    handleCancelWorkout,
    handleFinalizeWorkout,
    isFreestyle: routineId === 'freestyle',
  };
};