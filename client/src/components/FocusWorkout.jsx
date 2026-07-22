import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { fetchWithAuth } from '../apiClient';
import { toBaseKg, toDisplayWeight } from '../utils/unitConverter';

// 🔔 Audio & Haptic Chime trigger (Linked to Profile Preferences, Default: OFF)
const triggerRestCompleteAlert = () => {
  const enableHaptics = localStorage.getItem('enableHaptics') === 'true';
  const enableAudio = localStorage.getItem('enableAudioChime') === 'true';

  // 1. Mobile Haptic Vibration
  if (enableHaptics && typeof window !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }

  // 2. Synthesized Sound Effect
  if (enableAudio) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.25, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.22);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.22);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.22);
      osc2.stop(ctx.currentTime + 0.6);
    } catch (err) {
      console.error("Audio playback error:", err);
    }
  }
};

export default function FocusWorkout() {
  const { routineId } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();

  // ⚖️ Read user preferred unit
  const userUnit = (localStorage.getItem('preferredUnit') || 'lbs').toLowerCase();
  const weightUnitLabel = userUnit === 'kg' ? 'Kg' : 'Lbs';

  const [routine, setRoutine] = useState(null);
  const [workoutId, setWorkoutId] = useState(null); 
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(() => {
    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession && savedSession.routineId === routineId && savedSession.activeIndex !== undefined) {
      return savedSession.activeIndex;
    }
    return 0;
  });
  
  const [freestyleTrackingType, setFreestyleTrackingType] = useState('weight_reps');

  // States to handle all "Big 5" input types
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState('');

  const [allCompletedSets, setAllCompletedSets] = useState(() => {
    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession && savedSession.routineId === routineId && savedSession.completedSets) {
      return savedSession.completedSets;
    }
    return {};
  });
  const [editingSetIndex, setEditingSetIndex] = useState(null);
  const sessionStarted = useRef(false);

  // Live Elapsed Stopwatch State
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession && savedSession.startTime) {
      return Math.floor((Date.now() - savedSession.startTime) / 1000);
    }
    return 0;
  });

  // Rest Timer States
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isRestTimerRunning, setIsRestTimerRunning] = useState(false);

  // Rest Countdown Engine
  useEffect(() => {
    let interval = null;
    if (isRestTimerRunning && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (restTimeLeft === 0 && isRestTimerRunning) {
      setIsRestTimerRunning(false);
      triggerRestCompleteAlert();
    }
    return () => clearInterval(interval);
  }, [isRestTimerRunning, restTimeLeft]);

  const formatRestDisplay = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addRestTime = (secondsToAdd) => {
    setRestTimeLeft((prev) => prev + secondsToAdd);
    setIsRestTimerRunning(true);
  };

  const startRestTimer = (seconds) => {
    setRestTimeLeft(seconds);
    setIsRestTimerRunning(true);
  };

  const togglePauseRestTimer = () => {
    if (restTimeLeft > 0) {
      setIsRestTimerRunning(!isRestTimerRunning);
    }
  };

  // Autosave UI state to localStorage
  useEffect(() => {
    if (!workoutId) return;

    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession) {
      savedSession.completedSets = allCompletedSets;
      savedSession.activeIndex = activeExerciseIndex;
      localStorage.setItem('activeWorkoutSession', JSON.stringify(savedSession));
    }
  }, [allCompletedSets, activeExerciseIndex, workoutId]);

  // Stopwatch interval
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(mins)}:${pad(secs)}`;
  };

  useEffect(() => {
    if (sessionStarted.current) return;
    sessionStarted.current = true;

    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    const isResuming = savedSession && savedSession.routineId === routineId;

    // Handle Freestyle Mode
    if (routineId === 'freestyle') {
      const freestyleMock = {
        name: location.state?.customName || 'Freestyle Workout',
        exercises: [{
          id: 'c1f00c2b-4ec9-4ccb-8d67-2c52a405a1a7', 
          exercise_id: 'c1f00c2b-4ec9-4ccb-8d67-2c52a405a1a7',
          name: 'Freestyle Exercise',
          tracking_type: freestyleTrackingType,
          sets: []
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
        .then((res) => res.json())
        .then((sessionData) => {
          setWorkoutId(sessionData.id);
          localStorage.setItem('activeWorkoutSession', JSON.stringify({ 
            workoutId: sessionData.id, routineId, startTime: Date.now() 
          }));
        })
        .catch((err) => console.error("Error starting freestyle:", err));
      }
      return; 
    }

    // Standard Template Mode
    fetchWithAuth(`/api/v1/routines/${routineId}`)
      .then((res) => res.json())
      .then(async (data) => {
          const selectedRoutine = Array.isArray(data) 
            ? data.find((r) => r.id === routineId) 
            : data;

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
  }, [routineId, location.state, freestyleTrackingType]);

  const activeExercise = routine?.exercises?.[activeExerciseIndex];
  if (activeExercise && routineId === 'freestyle') {
    activeExercise.tracking_type = freestyleTrackingType;
  }

  const currentCompletedSets = allCompletedSets[activeExerciseIndex] || [];
  const currentSetIndex = currentCompletedSets.length;
  const plannedSet = activeExercise?.sets?.[currentSetIndex];

  useEffect(() => {
    if (editingSetIndex !== null) return; 

    if (plannedSet) {
      const targetWeightDisplay = plannedSet.weight != null 
        ? String(toDisplayWeight(plannedSet.weight, userUnit)) 
        : '';
      setWeight(targetWeightDisplay);
      setReps(plannedSet.reps != null ? String(plannedSet.reps) : '');
      setTimeMin(plannedSet.time_minutes != null ? String(plannedSet.time_minutes) : '');
      setTimeSec(plannedSet.time_seconds != null ? String(plannedSet.time_seconds) : '');
      setDistance(plannedSet.distance != null ? String(plannedSet.distance) : '');
      setRpe(''); 
    } else {
      setWeight('');
      setReps('');
      setTimeMin('');
      setTimeSec('');
      setDistance('');
      setRpe('');
    }
  }, [activeExerciseIndex, currentSetIndex, plannedSet, editingSetIndex, freestyleTrackingType, userUnit]);

  const handleCancelWorkout = async () => {
    const isSure = window.confirm("Are you sure you want to cancel? This will delete the workout entirely.");
    if (!isSure) return;

    localStorage.removeItem('activeWorkoutSession');

    try {
      await fetchWithAuth(`/api/v1/workouts/${workoutId}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error("Failed to delete canceled workout:", error);
    }

    navigate('/templates');
  };

  const handleFinalizeWorkout = async () => {
    localStorage.removeItem('activeWorkoutSession');

    try {
      await fetchWithAuth(`/api/v1/workouts/${workoutId}`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: elapsedSeconds })
      });
    } catch (error) {
      console.error("Failed to update final session timestamp duration:", error);
    }
    navigate(`/workouts/${workoutId}`);
  };

  if (!routine || !workoutId) {
    return <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>Loading session...</div>;
  }

  const isLastExercise = activeExerciseIndex === routine.exercises.length - 1;
  const targetSetsCount = activeExercise.sets ? activeExercise.sets.length : (activeExercise.target_sets || 3);

  const handleLogSet = async (e) => {
    e.preventDefault();
    
    const isEditing = editingSetIndex !== null;
    
    // ⚖️ Convert input weight (Lbs or Kg) into standard base kilograms for backend API
    const baseKgValue = weight === '' ? 0 : toBaseKg(weight, userUnit);

    const payload = {
      exercise_id: activeExercise.exercise_id || activeExercise.id, 
      set_number: isEditing ? editingSetIndex + 1 : currentCompletedSets.length + 1, 
      actual_weight_kg: baseKgValue, 
      actual_reps: reps === '' ? 0 : Number(reps),
      time_minutes: timeMin === '' ? 0 : Number(timeMin),
      time_seconds: timeSec === '' ? 0 : Number(timeSec),
      distance: distance === '' ? 0 : Number(distance),
      rpe: rpe === '' ? null : Number(rpe)
    };

    try {
      const endpoint = isEditing 
        ? `/api/v1/workouts/${workoutId}/sets/${currentCompletedSets[editingSetIndex].id}`
        : `/api/v1/workouts/${workoutId}/sets`;

      const response = await fetchWithAuth(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedSet = await response.json(); 
        const actualKg = savedSet.actual_weight_kg ?? baseKgValue;

        if (isEditing) {
          setAllCompletedSets(prev => {
            const updated = [...prev[activeExerciseIndex]];
            updated[editingSetIndex] = { 
              id: savedSet.id || currentCompletedSets[editingSetIndex].id, 
              weight, 
              actual_weight_kg: actualKg,
              reps, timeMin, timeSec, distance, rpe: rpe || null
            };
            return { ...prev, [activeExerciseIndex]: updated };
          });
          setEditingSetIndex(null); 
        } else {
          setAllCompletedSets(prev => ({
            ...prev,
            [activeExerciseIndex]: [...(prev[activeExerciseIndex] || []), { 
              id: savedSet.id, 
              weight, 
              actual_weight_kg: actualKg,
              reps, timeMin, timeSec, distance, rpe: rpe || null
            }]
          }));
          
          startRestTimer(90);
        }
        setRpe('');
      }
    } catch (error) {
      console.error("Failed to log/update set", error);
    }
  };

  const handleDeleteActiveSet = async () => {
    if (editingSetIndex === null) return;
    
    const isSure = window.confirm("Are you sure you want to delete this set?");
    if (!isSure) return;

    const setToDelete = currentCompletedSets[editingSetIndex];

    try {
      const response = await fetchWithAuth(`/api/v1/workouts/${workoutId}/sets/${setToDelete.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setAllCompletedSets(prev => {
          const updated = [...prev[activeExerciseIndex]];
          updated.splice(editingSetIndex, 1);
          return { ...prev, [activeExerciseIndex]: updated };
        });
        
        setEditingSetIndex(null); 
      } else {
        alert("Failed to delete set.");
      }
    } catch (error) {
      console.error("Error deleting active set:", error);
    }
  };
  
  const handleStartEdit = (index) => {
    const setToEdit = currentCompletedSets[index];
    setEditingSetIndex(index);

    // ⚖️ Dynamically format editing weight to preferred unit
    const displayWeight = setToEdit.actual_weight_kg !== undefined 
      ? String(toDisplayWeight(setToEdit.actual_weight_kg, userUnit))
      : (setToEdit.weight || '');

    setWeight(displayWeight);
    setReps(setToEdit.reps || '');
    setTimeMin(setToEdit.timeMin || '');
    setTimeSec(setToEdit.timeSec || '');
    setDistance(setToEdit.distance || '');
    setRpe(setToEdit.rpe || ''); 
  };

  const handleCancelEdit = () => {
    setEditingSetIndex(null);
  };

  const handleNextExercise = () => {
    setRestTimeLeft(0);
    setIsRestTimerRunning(false);

    if (!isLastExercise) {
      setActiveExerciseIndex(activeExerciseIndex + 1);
    } else {
      handleFinalizeWorkout();
    }
  };

  // ⚖️ Dynamic unit rendering for completed sets
  const renderCompletedSetText = (set, type) => {
    const displayWeight = set.actual_weight_kg !== undefined 
      ? toDisplayWeight(set.actual_weight_kg, userUnit) 
      : (set.weight || 0);

    if (type === 'time') return `${set.timeMin || 0}m ${set.timeSec || 0}s`;
    if (type === 'bodyweight_reps') return `${set.reps || 0} reps`;
    if (type === 'time_weight') return `${displayWeight} ${weightUnitLabel.toLowerCase()} × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
    if (type === 'distance_time') return `${set.distance || 0} mi × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
    return `${displayWeight} ${weightUnitLabel.toLowerCase()} × ${set.reps || 0} reps`; 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '90vh', gap: '20px' }}>
      
      {/* Top Header Group */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>{routine.name}</h2>
          
          <div style={{
            backgroundColor: '#2d2d34',
            color: '#10b981',
            padding: '4px 8px',
            borderRadius: '6px',
            fontWeight: '700',
            fontSize: '0.95rem',
            fontFamily: 'monospace'
          }}>
            ⏱️ {formatTime(elapsedSeconds)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button 
            onClick={handleCancelWorkout}
            style={{ backgroundColor: 'transparent', color: '#888', border: 'none', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button 
            onClick={handleFinalizeWorkout}
            style={{ backgroundColor: 'transparent', color: '#10b981', border: 'none', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Finish
          </button>
        </div>
      </div>

      {/* Main Focus Card */}
      <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '20px', flex: '1' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', color: '#fff' }}>{activeExercise.name}</h1>
          
          {activeExercise.tags && activeExercise.tags.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {activeExercise.tags.map((tag, i) => (
                <span 
                  key={i} 
                  style={{ background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <span style={{ color: '#888', fontSize: '0.9rem', backgroundColor: '#111', padding: '6px 12px', borderRadius: '12px' }}>
            Target: {targetSetsCount} Sets
          </span>
        </div>

        {/* Completed Sets Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {currentCompletedSets.map((set, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', border: '1px solid #2d2d2d', padding: '12px 16px', borderRadius: '8px' }}>
              <span style={{ color: '#888' }}>Set {i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>
                  {renderCompletedSetText(set, activeExercise.tracking_type)} 
                </span>
                
                {set.rpe && (
                  <span style={{ color: '#eab308', background: '#322203', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    RPE {set.rpe}
                  </span>
                )}
                
                <button 
                  type="button"
                  onClick={() => handleStartEdit(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: 0 }}
                >
                  ✏️
                </button>
                <span style={{ color: '#4ade80' }}>✓</span>
              </div>
            </div>
          ))}
        </div>

        {/* ⚖️ Dynamic unit rendering for planned set goal */}
        {plannedSet && (
          <div style={{ backgroundColor: '#2d2d2d', padding: '12px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', color: '#4ade80', fontWeight: 'bold', fontSize: '1rem', border: '1px dashed #4ade80' }}>
            🎯 Goal for Set {currentSetIndex + 1}: 
            {activeExercise.tracking_type === 'time' ? ` ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`
            : activeExercise.tracking_type === 'bodyweight_reps' ? ` ${plannedSet.reps || 0} reps`
            : activeExercise.tracking_type === 'time_weight' ? ` ${toDisplayWeight(plannedSet.weight || 0, userUnit)} ${weightUnitLabel.toLowerCase()} for ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`
            : activeExercise.tracking_type === 'distance_time' ? ` ${plannedSet.distance || 0} mi in ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`
            : ` ${toDisplayWeight(plannedSet.weight || 0, userUnit)} ${weightUnitLabel.toLowerCase()} × ${plannedSet.reps || 0} reps`}
          </div>
        )}

        {/* Dynamic Style Switcher (Freestyle mode) */}
        {routineId === 'freestyle' && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
            {['weight_reps', 'time', 'distance_time'].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setFreestyleTrackingType(type)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid #2d2d2d',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  backgroundColor: freestyleTrackingType === type ? '#2563eb' : '#111',
                  color: '#fff',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
              >
                {type === 'weight_reps' && '🏋️‍♂️ Lifting'}
                {type === 'time' && '⏱️ Time'}
                {type === 'distance_time' && '🏃‍♂️ Running/Cardio'}
              </button>
            ))}
          </div>
        )}

        {/* Dynamic Input Form */}
        <form onSubmit={handleLogSet} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            
            {activeExercise.tracking_type === 'time' ? (
              <>
                <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            ) : activeExercise.tracking_type === 'bodyweight_reps' ? (
              <input type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} style={{ flex: 4, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
            ) : activeExercise.tracking_type === 'time_weight' ? (
              <>
                <input type="number" placeholder={weightUnitLabel} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={{ flex: 1.5, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={{ flex: 1.5, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            ) : activeExercise.tracking_type === 'distance_time' ? (
              <>
                <input type="number" placeholder="Miles" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={{ flex: 1.5, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={{ flex: 1.5, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            ) : (
              <>
                <input type="number" placeholder={weightUnitLabel} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            )}

            <input 
              type="number" 
              placeholder="RPE" 
              step="0.5" 
              min="1" 
              max="10"
              value={rpe} 
              onChange={(e) => setRpe(e.target.value)} 
              style={{ 
                width: '75px', 
                backgroundColor: '#111', 
                border: '1px solid #2d2d2d', 
                borderRadius: '8px', 
                padding: '16px', 
                color: '#eab308', 
                fontSize: '1.1rem', 
                textAlign: 'center', 
                outline: 'none',
                fontWeight: 'bold'
              }} 
            />

          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            {editingSetIndex !== null && (
              <>
                <button 
                  type="button" 
                  onClick={handleCancelEdit}
                  style={{ backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 1 }}
                >
                  Cancel
                </button>
                
                <button 
                  type="button" 
                  onClick={handleDeleteActiveSet}
                  style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 1 }}
                >
                  Delete
                </button>
              </>
            )}
            
            <button 
              type="submit" 
              style={{ backgroundColor: editingSetIndex !== null ? '#eab308' : '#111', color: editingSetIndex !== null ? '#111' : '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 2 }}
            >
              {editingSetIndex !== null ? `Update Set ${editingSetIndex + 1}` : 'Log Set'}
            </button>
          </div>
        </form>

        {/* Next Exercise Button */}
        <button 
          onClick={handleNextExercise}
          style={{ width: '100%', padding: '16px', backgroundColor: isLastExercise ? '#4ade80' : '#2563eb', color: isLastExercise ? '#111' : '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
        >
          {isLastExercise ? "Finish Workout 🎉" : "Next Exercise ➔"}
        </button>

        {/* Dynamic Rest Timer Block */}
        <div style={{
          backgroundColor: '#111',
          border: '1px solid #2d2d2d',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '16px',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ 
              fontSize: '2.4rem', 
              fontFamily: 'monospace', 
              fontWeight: 'bold',
              color: restTimeLeft > 0 ? '#10b981' : '#555' 
            }}>
              {formatRestDisplay(restTimeLeft)}
            </span>
            {restTimeLeft > 0 && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {isRestTimerRunning ? '⏱️ Rest Active' : '⏸️ Paused'}
              </p>
            )}
          </div>

          {/* Quick-Stack & Control Action Row */}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              type="button"
              onClick={() => addRestTime(15)}
              style={{ backgroundColor: '#2d2d2d', color: '#10b981', border: '1px solid #10b981', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              +15s
            </button>
            <button 
              type="button"
              onClick={() => addRestTime(30)}
              style={{ backgroundColor: '#2d2d2d', color: '#10b981', border: '1px solid #10b981', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              +30s
            </button>
            <button 
              type="button"
              onClick={() => addRestTime(60)}
              style={{ backgroundColor: '#2d2d2d', color: '#10b981', border: '1px solid #10b981', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              +1m
            </button>

            {restTimeLeft > 0 && (
              <>
                <button 
                  type="button"
                  onClick={togglePauseRestTimer}
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  {isRestTimerRunning ? 'Pause' : 'Resume'}
                </button>
                <button 
                  type="button"
                  onClick={() => { setRestTimeLeft(0); setIsRestTimerRunning(false); }}
                  style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  Skip ✕
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM NAVIGATION: Horizontal Timeline */}
      <div style={{ marginTop: 'auto' }}>
        <h3 style={{ fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', marginBottom: '12px' }}>Workout Timeline</h3>
        <div style={{ 
          display: 'flex', 
          overflowX: 'auto', 
          gap: '12px', 
          paddingBottom: '16px',
          WebkitOverflowScrolling: 'touch' 
        }}>
          {routine.exercises.map((ex, index) => {
            const isActive = index === activeExerciseIndex;
            const setsDone = (allCompletedSets[index] || []).length;
            const tSets = ex.sets ? ex.sets.length : (ex.target_sets || 3);
            const isCompleted = setsDone >= tSets;

            return (
              <div 
                key={index}
                onClick={() => setActiveExerciseIndex(index)}
                style={{ 
                  flex: '0 0 auto', 
                  width: '140px', 
                  padding: '12px', 
                  borderRadius: '12px', 
                  cursor: 'pointer',
                  backgroundColor: isActive ? '#fff' : (isCompleted ? '#111' : '#1e1e1e'),
                  border: `1px solid ${isActive ? '#fff' : (isCompleted ? '#4ade80' : '#2d2d2d')}`,
                  opacity: (isCompleted && !isActive) ? 0.7 : 1,
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isActive ? '#000' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ex.name}
                  </span>
                </div>

                {ex.tags && ex.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {ex.tags.map((tag, i) => (
                      <span 
                        key={i} 
                        style={{ 
                          fontSize: '0.6rem', 
                          background: isActive ? '#2563eb' : '#2d2d2d', 
                          color: '#fff', 
                          padding: '2px 5px', 
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div style={{ fontSize: '0.75rem', color: isActive ? '#444' : '#888', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{setsDone}/{tSets} Sets</span>
                  {isCompleted && <span style={{ color: isActive ? '#10b981' : '#4ade80', fontWeight: 'bold' }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}