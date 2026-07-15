import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  }).format(date);
};

export default function WorkoutDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [workout, setWorkout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form States for logging a new set (Freestyle mode)
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [exerciseId] = useState("c1f00c2b-4ec9-4ccb-8d67-2c52a405a1a7");

  useEffect(() => {
    fetch(`http://localhost:3000/api/v1/workouts/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load workout');
        return res.json();
      })
      .then((data) => {
        setWorkout(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  const handleAddSet = (e) => {
    e.preventDefault();
    if (!weight || !reps) return;

    const nextSetNumber = workout.sets ? workout.sets.length + 1 : 1;

    fetch(`http://localhost:3000/api/v1/workouts/${id}/sets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exercise_id: exerciseId,
        set_number: nextSetNumber,
        actual_weight_kg: parseFloat(weight),
        actual_reps: parseInt(reps, 10),
        rpe: rpe ? parseFloat(rpe) : null
      })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to log set");
        return res.json();
      })
      .then((newSet) => {
        // Since we added it manually, we temporarily give it a fallback name so it renders
        newSet.exercise_name = "Freestyle Exercise"; 
        newSet.tracking_type = "weight_reps"; // Give freestyle a default type
        
        setWorkout({
          ...workout,
          sets: [...(workout.sets || []), newSet]
        });
        
        setWeight("");
        setReps("");
        setRpe("");
      })
      .catch((err) => console.error("Error logging set:", err));
  };

  if (loading) return <div className="app-container"><p style={{ color: '#888' }}>Loading workout...</p></div>;
  if (error) return <div className="app-container"><p style={{ color: '#ff4444' }}>{error}</p></div>;
  if (!workout) return <div className="app-container"><p>Workout not found.</p></div>;

  // --- NEW: Group the sets by exercise_name before rendering! ---
  const groupedSets = workout.sets ? workout.sets.reduce((acc, set) => {
    const name = set.exercise_name || 'Unknown Exercise';
    if (!acc[name]) acc[name] = [];
    acc[name].push(set);
    return acc;
  }, {}) : {};

  return (
    <div className="app-container">
      <header>
        <button 
          onClick={() => navigate('/')} 
          style={{ background: 'transparent', color: '#888', padding: '0', marginBottom: '10px', border: 'none', fontSize: '1rem', cursor: 'pointer' }}
        >
          ← Back to History
        </button>
        <h1>{workout.name}</h1>
        <span className="subtitle">{formatDate(workout.started_at)}</span>
      </header>

      {/* Logged Sets Feed - Now Grouped with Tags! */}
<div className="workout-list">
  
  {Object.keys(groupedSets).length > 0 ? (
    Object.entries(groupedSets).map(([exerciseName, setsForExercise]) => (
      <div key={exerciseName} style={{ marginBottom: '24px' }}>
        
        {/* ---> NEW: Exercise Header & Tags Container <--- */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '10px', borderBottom: '2px solid #2d2d2d', paddingBottom: '6px' }}>
          <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#fff' }}>
            {exerciseName}
          </h3>
          
          {/* Render tags if they exist on the set */}
          {setsForExercise[0]?.tags && setsForExercise[0].tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {setsForExercise[0].tags.map((tag, tagIndex) => (
                <span 
                  key={tagIndex} 
                  style={{ background: '#2563eb', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        
        {/* Individual Sets for this Exercise */}
        {setsForExercise.map((set, index) => (
          <div key={set.id} className="workout-card" style={{ padding: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '600' }}>Set {index + 1}</span>
              <span style={{ fontWeight: 'bold' }}>
                {set.tracking_type === 'time' 
                  ? `${set.time_minutes || 0}m ${set.time_seconds || 0}s`
                : set.tracking_type === 'distance_time' 
                  ? `${set.distance || 0} mi in ${set.time_minutes || 0}m ${set.time_seconds || 0}s`
                : set.tracking_type === 'time_weight'
                  ? `${set.actual_weight_kg || 0} lbs for ${set.time_minutes || 0}m ${set.time_seconds || 0}s`
                : set.tracking_type === 'bodyweight_reps'
                  ? `${set.actual_reps || 0} reps`
                : 
                  `${set.actual_weight_kg || 0} lbs × ${set.actual_reps || 0} reps`
                }
              </span>
              {set.rpe && <span style={{ color: '#888', fontSize: '0.85rem' }}>RPE {set.rpe}</span>}
            </div>
          </div>
        ))}
      </div>
    ))
  ) : (
    <p style={{ color: '#888', fontStyle: 'italic', padding: '8px 0' }}>No sets logged yet.</p>
  )}
</div>

      <hr style={{ border: '0', borderTop: '1px solid #eaeaea', margin: '24px 0' }} />

      {/* Freestyle Add Set Form Layout */}
      <div className="add-set-section">
        <h3>Log Freestyle Set</h3>
        <form onSubmit={handleAddSet} className="workout-form" style={{ marginTop: '10px' }}>
          <input 
            type="number" placeholder="lbs" step="0.1" required
            value={weight} onChange={(e) => setWeight(e.target.value)}
          />
          <input 
            type="number" placeholder="reps" required
            value={reps} onChange={(e) => setReps(e.target.value)}
          />
          <input 
            type="number" placeholder="RPE" step="0.5" max="10"
            value={rpe} onChange={(e) => setRpe(e.target.value)}
          />
          <button type="submit">＋</button>
        </form>
      </div>
    </div>
  )
}