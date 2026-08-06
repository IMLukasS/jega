import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../apiClient';
import { toBaseKg, toDisplayWeight } from '../utils/unitConverter';
import FreestyleTypeSwitcher from '../components/workout/FreestyleTypeSwitcher';
import ExercisePicker from '../components/common/ExercisePicker';

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  }).format(date);
};

const formatDuration = (totalSeconds) => {
  if (!totalSeconds) return '';
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
};

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const userUnit = (localStorage.getItem('preferredUnit') || 'lbs').toLowerCase();
  const weightUnitLabel = userUnit === 'kg' ? 'Kg' : 'Lbs';

  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected exercise state
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseId, setExerciseId] = useState(null);

  const pickerRef = useRef(null);

  // Add‑set form fields
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState('');
  const [freestyleTrackingType, setFreestyleTrackingType] = useState('weight_reps');

  // Inline edit states (for existing sets)
  const [editingSetId, setEditingSetId] = useState(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editMin, setEditMin] = useState('');
  const [editSec, setEditSec] = useState('');
  const [editDist, setEditDist] = useState('');
  const [editRpe, setEditRpe] = useState('');

  // Workout duration editing
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState('');

  // Fetch workout data
  useEffect(() => {
    fetchWithAuth(`/api/v1/workouts/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load workout');
        return res.json();
      })
      .then(data => {
        setWorkout(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  function handleExerciseSelected(exercise) {
    setExerciseName(exercise.title);
    setExerciseId(exercise.id);
  }

  const handleAddSet = async (e) => {
    e.preventDefault();
    if (!pickerRef.current) return;

    const exercise = await pickerRef.current.resolveCurrent();
    
    if (!exercise) {
      alert('Please select or type an exercise name.');
      return;
    }

    setExerciseId(exercise.id);
    setExerciseName(exercise.title);

    // Basic validation per tracking type
    if (freestyleTrackingType === 'weight_reps' && (!weight || !reps)) return;
    if (freestyleTrackingType === 'bodyweight_reps' && !reps) return;
    if (freestyleTrackingType === 'time' && !timeMin && !timeSec) return;
    if (freestyleTrackingType === 'time_weight' && (!weight || (!timeMin && !timeSec))) return;
    if (freestyleTrackingType === 'distance_time' && (!distance || (!timeMin && !timeSec))) return;

    try {
      const nextSetNumber = workout.sets ? workout.sets.length + 1 : 1;
      const baseKg = weight ? toBaseKg(weight, userUnit) : 0;

      const res = await fetchWithAuth(`/api/v1/workouts/${id}/sets`, {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: exercise.id,
          set_number: nextSetNumber,
          actual_weight_kg: baseKg,
          actual_reps: reps ? parseInt(reps, 10) : 0,
          time_minutes: timeMin ? Number(timeMin) : 0,
          time_seconds: timeSec ? Number(timeSec) : 0,
          distance: distance ? Number(distance) : 0,
          rpe: rpe ? parseFloat(rpe) : null
        })
      });
      if (!res.ok) throw new Error('Failed to log set');
      const newSet = await res.json();
      newSet.exercise_name = exercise.title;
      newSet.tracking_type = freestyleTrackingType;

      setWorkout(prev => ({
        ...prev,
        sets: [...(prev.sets || []), newSet]
      }));

      // Clear numeric fields, keep exercise name, ID and tracking type
      setWeight('');
      setReps('');
      setRpe('');
      setTimeMin('');
      setTimeSec('');
      setDistance('');
    } catch (err) {
      console.error('Error logging set:', err);
      alert('Could not log set: ' + err.message);
    }
  };

  const handleUpdateHistorySet = async (setId) => {
    try {
      const baseKg = editWeight === '' ? 0 : toBaseKg(editWeight, userUnit);
      const response = await fetchWithAuth(`/api/v1/workouts/${id}/sets/${setId}`, {
        method: 'PUT',
        body: JSON.stringify({
          actual_weight_kg: baseKg,
          actual_reps: editReps === '' ? 0 : Number(editReps),
          time_minutes: editMin === '' ? 0 : Number(editMin),
          time_seconds: editSec === '' ? 0 : Number(editSec),
          distance: editDist === '' ? 0 : Number(editDist),
          rpe: editRpe === '' ? null : Number(editRpe)
        })
      });
      if (response.ok) {
        const updatedSet = await response.json();
        setWorkout(prev => ({
          ...prev,
          sets: prev.sets.map(s => s.id === setId ? {
            ...s,
            actual_weight_kg: updatedSet.actual_weight_kg ?? baseKg,
            actual_reps: updatedSet.actual_reps,
            time_minutes: updatedSet.time_minutes,
            time_seconds: updatedSet.time_seconds,
            distance: updatedSet.distance,
            rpe: updatedSet.rpe
          } : s)
        }));
        setEditingSetId(null);
      }
    } catch (error) {
      console.error("Failed to update historical set", error);
    }
  };

  const handleDeleteHistorySet = async (setId) => {
    const isSure = window.confirm("Are you sure you want to delete this set?");
    if (!isSure) return;
    try {
      const response = await fetchWithAuth(`/api/v1/workouts/${id}/sets/${setId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setWorkout(prev => ({
          ...prev,
          sets: prev.sets.filter(s => s.id !== setId)
        }));
        setEditingSetId(null);
      } else {
        alert("Failed to delete the set.");
      }
    } catch (error) {
      console.error("Error deleting set:", error);
    }
  };

  const startInlineEdit = (set) => {
    setEditingSetId(set.id);
    const displayWeight = set.actual_weight_kg != null
      ? String(toDisplayWeight(set.actual_weight_kg, userUnit))
      : '';
    setEditWeight(displayWeight);
    setEditReps(set.actual_reps ?? '');
    setEditMin(set.time_minutes ?? '');
    setEditSec(set.time_seconds ?? '');
    setEditDist(set.distance ?? '');
    setEditRpe(set.rpe ?? '');
  };

  // Duration editing handlers
  const startEditDuration = () => {
    setDurationInput(workout.duration_seconds ? String(Math.round(workout.duration_seconds / 60)) : '');
    setEditingDuration(true);
  };

  const handleSaveDuration = async () => {
    const totalSeconds = Math.round((durationInput === '' ? 0 : Number(durationInput)) * 60);
    try {
      const res = await fetchWithAuth(`/api/v1/workouts/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: totalSeconds })
      });
      if (res.ok) {
        setWorkout(prev => ({ ...prev, duration_seconds: totalSeconds }));
        setEditingDuration(false);
      }
    } catch (err) {
      console.error('Failed to save duration', err);
    }
  };

  if (loading) return <div className="app-container"><p style={{ color: '#888' }}>Loading workout...</p></div>;
  if (error) return <div className="app-container"><p style={{ color: '#ff4444' }}>{error}</p></div>;
  if (!workout) return <div className="app-container"><p>Workout not found.</p></div>;

  const sortedSets = workout.sets
    ? [...workout.sets].sort((a, b) => a.set_number - b.set_number)
    : [];

  const groupedSets = sortedSets.reduce((acc, set) => {
    const name = set.exercise_name || 'Unknown Exercise';
    if (!acc[name]) acc[name] = [];
    acc[name].push(set);
    return acc;
  }, {});

  const orderedGroupedEntries = Object.entries(groupedSets).sort((a, b) => {
    const orderA = a[1][0]?.sequence_order ?? 999;
    const orderB = b[1][0]?.sequence_order ?? 999;
    return orderA - orderB;
  });

  const inputStyle = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #2d2d2d',
    background: '#111',
    color: '#fff',
    textAlign: 'center'
  };

  return (
    <div className="app-container">
      <header>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', color: '#888', padding: '0', marginBottom: '10px', border: 'none', fontSize: '1rem', cursor: 'pointer' }}>
          ← Back to History
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '4px' }}>
          <h1 style={{ margin: 0 }}>{workout.name}</h1>

          {editingDuration ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input type="number" min="0" autoFocus placeholder="min" value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                style={{ width: '60px', padding: '4px 8px', borderRadius: '6px', background: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
              <span style={{ color: '#888', fontSize: '0.85rem' }}>min</span>
              <button onClick={handleSaveDuration} style={{ background: '#4ade80', color: '#111', border: 'none', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingDuration(false)} style={{ background: '#444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}>✕</button>
            </div>
          ) : workout.duration_seconds > 0 ? (
            <div onClick={startEditDuration} title="Tap to edit" style={{ backgroundColor: '#2d2d34', color: '#10b981', padding: '4px 10px', borderRadius: '6px', fontWeight: '700', fontSize: '0.9rem', fontFamily: 'monospace', cursor: 'pointer' }}>
              ⏱️ {formatDuration(workout.duration_seconds)}
            </div>
          ) : (
            <button onClick={startEditDuration} style={{ background: 'transparent', border: '1px dashed #444', color: '#888', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
              + Add duration
            </button>
          )}
        </div>
        <span className="subtitle">{formatDate(workout.started_at)}</span>
      </header>

      <div className="workout-list">
        {orderedGroupedEntries.length > 0 ? (
          orderedGroupedEntries.map(([exName, setsForExercise]) => (
            <div key={exName} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', borderBottom: '2px solid #2d2d2d', paddingBottom: '6px' }}>
                <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#fff' }}>{exName}</h3>
                {setsForExercise[0]?.tags && setsForExercise[0].tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {setsForExercise[0].tags.map((tag, tagIndex) => (
                      <span key={tagIndex} style={{ background: '#2563eb', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>

              {setsForExercise.map((set, index) => {
                const isEditingRow = editingSetId === set.id;
                const displayWeight = toDisplayWeight(set.actual_weight_kg || 0, userUnit);

                return (
                  <div key={set.id} className="workout-card" style={{ padding: '12px', marginBottom: '8px' }}>
                    {isEditingRow ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
                        <span style={{ fontWeight: '600', color: '#888', marginRight: '4px' }}>Set {index + 1}</span>

                        {set.tracking_type === 'time' ? (
                          <>
                            <input type="number" placeholder="Min" value={editMin} onChange={e => setEditMin(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                            <input type="number" placeholder="Sec" value={editSec} onChange={e => setEditSec(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                          </>
                        ) : set.tracking_type === 'distance_time' ? (
                          <>
                            <input type="number" step="0.1" placeholder="Mi" value={editDist} onChange={e => setEditDist(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                            <input type="number" placeholder="Min" value={editMin} onChange={e => setEditMin(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                            <input type="number" placeholder="Sec" value={editSec} onChange={e => setEditSec(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                          </>
                        ) : set.tracking_type === 'time_weight' ? (
                          <>
                            <input type="number" step="0.1" placeholder={weightUnitLabel} value={editWeight} onChange={e => setEditWeight(e.target.value)} style={{ width: '65px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                            <input type="number" placeholder="Min" value={editMin} onChange={e => setEditMin(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                            <input type="number" placeholder="Sec" value={editSec} onChange={e => setEditSec(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                          </>
                        ) : set.tracking_type === 'bodyweight_reps' ? (
                          <input type="number" placeholder="Reps" value={editReps} onChange={e => setEditReps(e.target.value)} style={{ width: '65px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                        ) : (
                          <>
                            <input type="number" step="0.1" placeholder={weightUnitLabel} value={editWeight} onChange={e => setEditWeight(e.target.value)} style={{ width: '65px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                            <input type="number" placeholder="Reps" value={editReps} onChange={e => setEditReps(e.target.value)} style={{ width: '65px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#fff', border: '1px solid #444', textAlign: 'center' }} />
                          </>
                        )}

                        <input type="number" step="0.5" max="10" placeholder="RPE" value={editRpe} onChange={e => setEditRpe(e.target.value)} style={{ width: '55px', padding: '6px', borderRadius: '6px', backgroundColor: '#111', color: '#888', border: '1px solid #444', textAlign: 'center' }} />

                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                          <button onClick={() => handleUpdateHistorySet(set.id)} style={{ backgroundColor: '#4ade80', color: '#111', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Save</button>
                          <button onClick={() => handleDeleteHistorySet(set.id)} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Delete</button>
                          <button onClick={() => setEditingSetId(null)} style={{ backgroundColor: '#444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>✕</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: '600' }}>Set {index + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontWeight: 'bold' }}>
                            {set.tracking_type === 'time'
                              ? `${set.time_minutes || 0}m ${set.time_seconds || 0}s`
                              : set.tracking_type === 'distance_time'
                              ? `${set.distance || 0} mi in ${set.time_minutes || 0}m ${set.time_seconds || 0}s`
                              : set.tracking_type === 'time_weight'
                              ? `${displayWeight} ${weightUnitLabel.toLowerCase()} for ${set.time_minutes || 0}m ${set.time_seconds || 0}s`
                              : set.tracking_type === 'bodyweight_reps'
                              ? `${set.actual_reps || 0} reps`
                              : `${displayWeight} ${weightUnitLabel.toLowerCase()} × ${set.actual_reps || 0} reps`
                            }
                          </span>
                          {set.rpe && <span style={{ color: '#888', fontSize: '0.85rem' }}>RPE {set.rpe}</span>}
                          <button
                            type="button"
                            onClick={() => startInlineEdit(set)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: 0, marginLeft: '4px' }}
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <p style={{ color: '#888', fontStyle: 'italic', padding: '8px 0' }}>No sets logged yet.</p>
        )}
      </div>

      <hr style={{ border: '0', borderTop: '1px solid #2d2d2d', margin: '24px 0' }} />

      <div className="add-set-section">
        <h3>Log Freestyle Set</h3>

        <form onSubmit={handleAddSet} style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '8px' }}>
          
          <div style={{ gridColumn: '1 / -1' }}>
            <ExercisePicker
              ref={pickerRef}
              onSelect={handleExerciseSelected} 
              placeholder="Log an exercise…" 
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <FreestyleTypeSwitcher currentType={freestyleTrackingType} onTypeChange={setFreestyleTrackingType} />
          </div>

          {freestyleTrackingType === 'time' && (
            <>
              <input type="number" placeholder="min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={inputStyle} />
            </>
          )}
          {freestyleTrackingType === 'distance_time' && (
            <>
              <input type="number" step="0.1" placeholder="mi" value={distance} onChange={(e) => setDistance(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={inputStyle} />
            </>
          )}
          {freestyleTrackingType === 'time_weight' && (
            <>
              <input type="number" step="0.1" placeholder={weightUnitLabel.toLowerCase()} value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={inputStyle} />
            </>
          )}
          {freestyleTrackingType === 'bodyweight_reps' && (
            <input type="number" placeholder="reps" value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle} />
          )}
          {freestyleTrackingType === 'weight_reps' && (
            <>
              <input type="number" step="0.1" placeholder={weightUnitLabel.toLowerCase()} value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} />
              <input type="number" placeholder="reps" value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle} />
            </>
          )}

          <input type="number" placeholder="RPE" step="0.5" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} style={inputStyle} />

          <button type="submit" style={{
            gridColumn: '1 / -1',
            padding: '12px',
            background: '#4ade80',
            color: '#111',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            opacity: 1
          }}>
            + Log Set
          </button>
        </form>
      </div>
    </div>
  );
}