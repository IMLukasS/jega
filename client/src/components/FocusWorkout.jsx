import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function FocusWorkout() {
  const { routineId } = useParams(); 
  const navigate = useNavigate();

  const [routine, setRoutine] = useState(null);
  const [workoutId, setWorkoutId] = useState(null); 
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  
  // ---> NEW: Expanded state to handle all "Big 5" input types
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const [distance, setDistance] = useState('');
  
  const [allCompletedSets, setAllCompletedSets] = useState({});

  useEffect(() => {
    fetch('http://localhost:3000/api/v1/routines')
      .then((res) => res.json())
      .then(async (data) => {
        const selectedRoutine = data.find((r) => r.id === routineId);
        if (!selectedRoutine) return;
        setRoutine(selectedRoutine);

        // ---> UPDATE: Added routine_id to the request body below
        const startSessionRes = await fetch('http://localhost:3000/api/v1/workouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: `${selectedRoutine.name} Session`,
            routine_id: selectedRoutine.id // ---> FIX: Linked!
          })
        });
        
        const sessionData = await startSessionRes.json();
        setWorkoutId(sessionData.id);
      });
  }, [routineId]); 

  if (!routine || !workoutId) {
    return <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>Loading session...</div>;
  }

  const activeExercise = routine.exercises[activeExerciseIndex];
  const isLastExercise = activeExerciseIndex === routine.exercises.length - 1;
  const currentCompletedSets = allCompletedSets[activeExerciseIndex] || [];
  const currentSetIndex = currentCompletedSets.length;
  const plannedSet = activeExercise.sets && activeExercise.sets[currentSetIndex];
  
  // Safely grab the target sets count from the new template array, fallback to 3
  const targetSetsCount = activeExercise.sets ? activeExercise.sets.length : (activeExercise.target_sets || 3);

  const handleLogSet = async (e) => {
    e.preventDefault();
    
    // ---> NEW: Send all potential fields to the backend. Empty fields can just be null.
    try {
      const response = await fetch(`http://localhost:3000/api/v1/workouts/${workoutId}/sets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exercise_id: activeExercise.exercise_id || activeExercise.id, 
          set_number: currentCompletedSets.length + 1, 
          actual_weight_kg: weight ? Number(weight) : null, 
          actual_reps: reps ? Number(reps) : null,
          time_minutes: timeMin ? Number(timeMin) : null,
          time_seconds: timeSec ? Number(timeSec) : null,
          distance: distance ? Number(distance) : null
        })
      });

      if (response.ok) {
        // Save to local UI state so we can see it rendered immediately
        setAllCompletedSets(prev => ({
          ...prev,
          [activeExerciseIndex]: [...(prev[activeExerciseIndex] || []), { weight, reps, timeMin, timeSec, distance }]
        }));
        
        // Clear the inputs for the next set
        setWeight('');
        setReps('');
        setTimeMin('');
        setTimeSec('');
        setDistance('');
      }
    } catch (error) {
      console.error("Failed to log set", error);
    }
  };

  const handleNextExercise = () => {
    if (!isLastExercise) {
      setActiveExerciseIndex(activeExerciseIndex + 1);
    } else {
      navigate(`/workouts/${workoutId}`);
    }
  };

  // ---> NEW: Helper to format the logged text cleanly based on tracking type
  const renderCompletedSetText = (set, type) => {
    if (type === 'time') return `${set.timeMin || 0}m ${set.timeSec || 0}s`;
    if (type === 'bodyweight_reps') return `${set.reps || 0} reps`;
    if (type === 'time_weight') return `${set.weight || 0} lbs × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
    if (type === 'distance_time') return `${set.distance || 0} mi × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
    return `${set.weight || 0} lbs × ${set.reps || 0} reps`; // Default Weight & Reps
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '90vh', gap: '20px' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>{routine.name}</h2>
        <button 
          onClick={() => navigate(`/workouts/${workoutId}`)}
          style={{ backgroundColor: 'transparent', color: '#ef4444', border: 'none', fontSize: '0.9rem', fontWeight: 'bold' }}
        >
          End Early
        </button>
      </div>

      {/* Main Focus Card */}
<div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '20px', flex: '1' }}>
  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
    {/* Exercise Name */}
    <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', color: '#fff' }}>{activeExercise.name}</h1>
    
    {/* --- ADDED: Active Exercise Tags --- */}
    {activeExercise.tags && activeExercise.tags.length > 0 && (
      <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {activeExercise.tags.map((tag, i) => (
          <span 
            key={i} 
            style={{ 
              background: '#2563eb', // Nice solid blue tag
              color: '#fff', 
              padding: '4px 10px', 
              borderRadius: '12px', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    )}

    {/* Target Sets */}
    <span style={{ color: '#888', fontSize: '0.9rem', backgroundColor: '#111', padding: '6px 12px', borderRadius: '12px' }}>
      Target: {targetSetsCount} Sets
    </span>
  </div>

        {/* Completed Sets Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {currentCompletedSets.map((set, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', backgroundColor: '#111', border: '1px solid #2d2d2d', padding: '12px 16px', borderRadius: '8px' }}>
              <span style={{ color: '#888' }}>Set {i + 1}</span>
              <span style={{ color: '#fff', fontWeight: 'bold' }}>
                {renderCompletedSetText(set, activeExercise.tracking_type)} 
                <span style={{ color: '#4ade80', marginLeft: '8px' }}>✓</span>
              </span>
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
                <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            ) : activeExercise.tracking_type === 'bodyweight_reps' ? (
              <input type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
            ) : activeExercise.tracking_type === 'time_weight' ? (
              <>
                <input type="number" placeholder="Lbs" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            ) : activeExercise.tracking_type === 'distance_time' ? (
              <>
                <input type="number" placeholder="Miles" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            ) : (
              <>
                <input type="number" placeholder="Lbs" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                <input type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} required style={{ flex: 1, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
              </>
            )}

          </div>
          <button type="submit" style={{ backgroundColor: '#fff', color: '#111', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', width: '100%' }}>
            Log Set
          </button>
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
            // ---> NEW: Checks template array for target, otherwise defaults
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
                {/* 1. Exercise Name */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isActive ? '#000' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ex.name}
                  </span>
                </div>

                {/* --- 2. ADDED: Micro Tags in Timeline --- */}
                {ex.tags && ex.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {ex.tags.map((tag, i) => (
                      <span 
                        key={i} 
                        style={{ 
                          fontSize: '0.6rem', 
                          // If active card, we use a nice blue. If inactive, we use a dark grey.
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

                {/* 3. Sets Progress */}
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