import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function FocusWorkout() {
  const { routineId } = useParams(); 
  const navigate = useNavigate();

  const [routine, setRoutine] = useState(null);
  const [workoutId, setWorkoutId] = useState(null); 
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  
  // States to handle all "Big 5" input types
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState('');

  const [allCompletedSets, setAllCompletedSets] = useState({});
  const [editingSetIndex, setEditingSetIndex] = useState(null);
  const sessionStarted = useRef(false);

  // ⏱️ NEW: Elapsed Time Stopwatch State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // ⏱️ NEW: Running interval tracking side-effect
  useEffect(() => {
    const timerInterval = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    return () => clearInterval(timerInterval);
  }, []);

  // ⏱️ NEW: Monospace clean layout timestamp formatter
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

    fetch('http://localhost:3000/api/v1/routines')
    .then((res) => res.json())
    .then(async (data) => {
        const selectedRoutine = data.find((r) => r.id === routineId);
        if (!selectedRoutine) return;
        setRoutine(selectedRoutine);

        const startSessionRes = await fetch('http://localhost:3000/api/v1/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              name: `${selectedRoutine.name} Session`,
              routine_id: selectedRoutine.id 
          })
        });
        
        const sessionData = await startSessionRes.json();
        setWorkoutId(sessionData.id);
    });
  }, [routineId]);

  const activeExercise = routine?.exercises?.[activeExerciseIndex];
  const currentCompletedSets = allCompletedSets[activeExerciseIndex] || [];
  const currentSetIndex = currentCompletedSets.length;
  const plannedSet = activeExercise?.sets?.[currentSetIndex];

  useEffect(() => {
    if (editingSetIndex !== null) return; 

    if (plannedSet) {
      setWeight(plannedSet.weight != null ? String(plannedSet.weight) : '');
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
  }, [activeExerciseIndex, currentSetIndex, plannedSet, editingSetIndex]);

  // ⏱️ NEW: Saves total session duration to backend before navigating away
  const handleFinalizeWorkout = async () => {
    try {
      await fetch(`http://localhost:3000/api/v1/workouts/${workoutId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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
    const payload = {
      exercise_id: activeExercise.exercise_id || activeExercise.id, 
      set_number: isEditing ? editingSetIndex + 1 : currentCompletedSets.length + 1, 
      actual_weight_kg: weight === '' ? 0 : Number(weight), 
      actual_reps: reps === '' ? 0 : Number(reps),
      time_minutes: timeMin === '' ? 0 : Number(timeMin),
      time_seconds: timeSec === '' ? 0 : Number(timeSec),
      distance: distance === '' ? 0 : Number(distance),
      rpe: rpe === '' ? null : Number(rpe)
    };

    try {
      const url = isEditing 
        ? `http://localhost:3000/api/v1/workouts/${workoutId}/sets/${currentCompletedSets[editingSetIndex].id}`
        : `http://localhost:3000/api/v1/workouts/${workoutId}/sets`;

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const savedSet = await response.json(); 

        if (isEditing) {
          setAllCompletedSets(prev => {
            const updated = [...prev[activeExerciseIndex]];
            updated[editingSetIndex] = { 
              id: savedSet.id || currentCompletedSets[editingSetIndex].id, 
              weight, reps, timeMin, timeSec, distance, rpe: rpe || null
            };
            return { ...prev, [activeExerciseIndex]: updated };
          });
          setEditingSetIndex(null); 
        } else {
          setAllCompletedSets(prev => ({
            ...prev,
            [activeExerciseIndex]: [...(prev[activeExerciseIndex] || []), { 
              id: savedSet.id, weight, reps, timeMin, timeSec, distance, rpe: rpe || null
            }]
          }));
        }
        setRpe('');
      }
    } catch (error) {
      console.error("Failed to log/update set", error);
    }
  };
  
  const handleStartEdit = (index) => {
    const setToEdit = currentCompletedSets[index];
    setEditingSetIndex(index);
    setWeight(setToEdit.weight || '');
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
    if (!isLastExercise) {
      setActiveExerciseIndex(activeExerciseIndex + 1);
    } else {
      handleFinalizeWorkout(); // ⏱️ Modified to store timer data
    }
  };

  const renderCompletedSetText = (set, type) => {
    if (type === 'time') return `${set.timeMin || 0}m ${set.timeSec || 0}s`;
    if (type === 'bodyweight_reps') return `${set.reps || 0} reps`;
    if (type === 'time_weight') return `${set.weight || 0} lbs × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
    if (type === 'distance_time') return `${set.distance || 0} mi × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
    return `${set.weight || 0} lbs × ${set.reps || 0} reps`; 
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '90vh', gap: '20px' }}>
      
      {/* Top Header Group */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>{routine.name}</h2>
          
          {/* ⏱️ NEW: Top Left Running Live Stopwatch Widget */}
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

        <button 
          onClick={handleFinalizeWorkout} // ⏱️ Modified to store timer data
          style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}
        >
          End Early
        </button>
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
                  <span style={{ color: '#eab308', fontSize: '0.85rem', background: '#322203', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
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

        {plannedSet && (
          <div style={{ backgroundColor: '#2d2d2d', padding: '12px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', color: '#4ade80', fontWeight: 'bold', fontSize: '1rem', border: '1px dashed #4ade80' }}>
            🎯 Goal for Set {currentSetIndex + 1}: 
            {activeExercise.tracking_type === 'time' ? ` ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`
            : activeExercise.tracking_type === 'bodyweight_reps' ? ` ${plannedSet.reps || 0} reps`
            : activeExercise.tracking_type === 'time_weight' ? ` ${plannedSet.weight || 0} lbs for ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`
            : activeExercise.tracking_type === 'distance_time' ? ` ${plannedSet.distance || 0} mi in ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`
            : ` ${plannedSet.weight || 0} lbs × ${plannedSet.reps || 0} reps`}
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
                <input type="number" placeholder="Lbs" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
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
                <input type="number" placeholder="Lbs" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} style={{ flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
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
              <button 
                type="button" 
                onClick={handleCancelEdit}
                style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 1 }}
              >
                Cancel
              </button>
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
          style={{ width: '100%', padding: '16px', backgroundColor: isLastExercise ? '#4ade80' : '#2563eb', color: isLastExercise ? '#111' : '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem' }}
        >
          {isLastExercise ? "Finish Workout 🎉" : "Next Exercise ➔"}
        </button>
      </div>

      {/* BOTTOM NAVIGATION: The Horizontal Timeline */}
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
                  {isCompleted && <span style={{ color: isActive ? '#10b981' : '#4ade80' }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}