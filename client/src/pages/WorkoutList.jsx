import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

const formatDate = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  }).format(date);
};

function WorkoutList() {
  const navigate = useNavigate()
  
  // Existing state
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  
  // NEW State: For your blueprint templates
  const [routines, setRoutines] = useState([]);

  useEffect(() => {
    // Fetch History
    fetch('http://localhost:3000/api/v1/workouts')
      .then((res) => res.json())
      .then((data) => {
        setWorkouts(data);
        setLoading(false);
      })
      .catch((err) => console.error('Error fetching workouts:', err));

    // NEW: Fetch Routines (Blueprints)
    fetch('http://localhost:3000/api/v1/routines')
      .then((res) => res.json())
      .then((data) => setRoutines(data))
      .catch((err) => console.error('Error fetching routines:', err));
  }, []);

  const handleCreateWorkout = (e) => {
    e.preventDefault();
    if (!newWorkoutName.trim()) return;

    fetch('http://localhost:3000/api/v1/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWorkoutName })
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to create workout");
        return res.json();
      })
      .then((newWorkout) => {
        setWorkouts([newWorkout, ...workouts]);
        setNewWorkoutName("");
      })
      .catch((err) => console.error('Error creating workout:', err));
  };

  if (loading) return <p style={{ color: '#888', padding: '20px' }}>Loading...</p>;

  return (
    <div className="app-container">
      <header>
        <h1>Jega</h1>
        <span className="subtitle">Home</span>
      </header>

      {/* --- NEW SECTION: Start a Routine --- */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>My Templates</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {routines.map((routine) => (
            <div key={routine.id} className="workout-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: '0 0 5px 0' }}>{routine.name}</h3>
                <span style={{ fontSize: '0.85rem', color: '#666' }}>{routine.exercises?.length || 0} Exercises</span>
              </div>
              <Link 
                to={`/focus/${routine.id}`} 
                style={{ backgroundColor: '#000', color: '#fff', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}
              >
                Start
              </Link>
            </div>
          ))}
        </div>
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid #eaeaea', marginBottom: '2rem' }} />


      {/* --- EXISTING SECTION: Freestyle & History --- */}
      <h2 style={{ fontSize: '1.2rem', marginBottom: '10px' }}>Freestyle Workout</h2>
      <form onSubmit={handleCreateWorkout} className="workout-form">
        <input 
          type="text" 
          placeholder="e.g., Quick Arm Day" 
          value={newWorkoutName}
          onChange={(e) => setNewWorkoutName(e.target.value)}
        />
        <button type="submit">Start</button>
      </form>
      
      <h2 style={{ fontSize: '1.2rem', marginTop: '2rem', marginBottom: '10px' }}>History</h2>
      <div className="workout-list">
        {workouts.map((workout) => (
          <div key={workout.id} className="workout-card" onClick={() => navigate(`/workouts/${workout.id}`)} style={{ cursor: 'pointer' }}>
            <div className="card-header">
              <h3>{workout.name}</h3>
              <span className="card-date">{formatDate(workout.started_at)}</span>
            </div>
            {workout.notes && <p className="card-notes">{workout.notes}</p>}
          </div>
        ))}
      </div>

    </div>
  );
}

export default WorkoutList;