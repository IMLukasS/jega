import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import WorkoutCalendarGrid from '../components/WorkoutCalendarGrid';

export default function Dashboard() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWorkoutName, setNewWorkoutName] = useState("");

  useEffect(() => {
    // Fetch all workout records to feed into the consistency grid
    fetch('http://localhost:3000/api/v1/workouts')
      .then((res) => res.json())
      .then((data) => {
        setWorkouts(data);
        setLoading(false);
      })
      .catch((err) => console.error('Error fetching history:', err));
  }, []);

  // --- NEW: Trigger our backend DELETE endpoint ---
  const handleDeleteWorkout = async (workoutId) => {
    try {
      const response = await fetch(`http://localhost:3000/api/v1/workouts/${workoutId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error("Failed to delete the workout record.");

      // Instantly remove it from state so the calendar cell updates
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    } catch (error) {
      console.error('Deletion error:', error);
      alert('Could not delete workout. Verify backend is running.');
    }
  };

  const handleCreateFreestyle = (e) => {
    e.preventDefault();
    if (!newWorkoutName.trim()) return;

    fetch('http://localhost:3000/api/v1/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newWorkoutName })
    })
      .then((res) => res.json())
      .then((newWorkout) => {
        setWorkouts([newWorkout, ...workouts]);
        setNewWorkoutName("");
        // Instantly throw them into the active workout tracking room
        navigate(`/focus/freestyle`, { state: { workoutId: newWorkout.id, name: newWorkout.name } });
      })
      .catch((err) => console.error('Error starting freestyle:', err));
  };

  if (loading) return <p style={{ color: '#888', padding: '20px' }}>Loading Dashboard...</p>;

  return (
    <div className="app-container">
      <header>
        <h1>Jega</h1>
        <span className="subtitle">Dashboard</span>
      </header>

      {/* Modern High-Level Navigation Portal Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <Link to="/templates" style={{ 
        background: '#2d2d34', padding: '20px', borderRadius: '12px', textDecoration: 'none', color: '#fff' 
        }}>
        <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>🏋️‍♂️ My Workouts</h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Launch or design workouts</p>
        </Link>
        
        <div style={{ background: '#2d2d34', padding: '20px', borderRadius: '12px', color: '#fff' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>⏱️ Freestyle Session</h3>
          <form onSubmit={handleCreateFreestyle} style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Quick session name..." 
              value={newWorkoutName}
              onChange={(e) => setNewWorkoutName(e.target.value)}
              style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #444', background: '#1e1e24', color: '#fff' }}
            />
            <button type="submit" style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Start</button>
          </form>
        </div>
      </div>

      {/* The Central Consistency Heatmap Grid */}
      <WorkoutCalendarGrid workouts={workouts} onDeleteWorkout={handleDeleteWorkout} />
    </div>
  );
}