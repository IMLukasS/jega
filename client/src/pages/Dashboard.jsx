import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import WorkoutCalendarGrid from '../components/WorkoutCalendarGrid';
import API_URL from '../api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newWorkoutName, setNewWorkoutName] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/api/v1/workouts`)
      .then((res) => res.json())
      .then((data) => {
        setWorkouts(data);
        setLoading(false);
      })
      .catch((err) => console.error('Error fetching history:', err));
  }, []);

  const handleDeleteWorkout = async (workoutId) => {
    try {
      const response = await fetch(`${API_URL}/api/v1/workouts/${workoutId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error("Failed to delete the workout record.");
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    } catch (error) {
      console.error('Deletion error:', error);
      alert('Could not delete workout. Verify backend is running.');
    }
  };

  // ⏱️ NEW: Calculate Rolling 7-Day Stats dynamically
  const getWeeklyStats = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Filter workouts from the last 7 days
    const weeklyWorkouts = workouts.filter(w => {
      if (!w.started_at) return false;
      const wDate = new Date(w.started_at);
      return wDate >= sevenDaysAgo && wDate <= now;
    });

    // Sum up duration
    const totalSeconds = weeklyWorkouts.reduce((sum, w) => sum + (w.duration_seconds || 0), 0);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);

    let formattedTime = "";
    if (hrs > 0) {
      formattedTime = `${hrs}h ${mins}m`;
    } else {
      formattedTime = `${mins}m`;
    }

    return {
      count: weeklyWorkouts.length,
      time: formattedTime
    };
  };

  if (loading) return <p style={{ color: '#888', padding: '20px' }}>Loading Dashboard...</p>;

  const stats = getWeeklyStats();

  return (
    <div className="app-container">
      <header>
        <h1>Jega</h1>
        <span className="subtitle">Dashboard</span>
      </header>

      {/* Modern High-Level Navigation Portal Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
        <Link to="/templates" style={{ 
          background: '#2d2d34', padding: '20px', borderRadius: '12px', textDecoration: 'none', color: '#fff', display: 'block' 
        }}>
          <h3 style={{ margin: '0 0 5px 0', fontSize: '1.1rem' }}>🏋️‍♂️ My Workouts</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#a1a1aa' }}>Launch or design workouts</p>
        </Link>
      </div>

      {/* 📊 NEW: Weekly Stats Summary Panel */}
      <div style={{ 
        background: '#2d2d34', 
        padding: '16px 20px', 
        borderRadius: '12px', 
        marginBottom: '24px', 
        display: 'flex', 
        justifyContent: 'space-around', 
        alignItems: 'center', 
        border: '1px solid #3e3e4a' 
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Past 7 Days</span>
          <strong style={{ fontSize: '1.5rem', color: '#10b981' }}>{stats.count} Workout{stats.count !== 1 ? 's' : ''} 🔥</strong>
        </div>
        <div style={{ height: '30px', width: '1px', background: '#3e3e4a' }} />
        <div style={{ textAlign: 'center' }}>
          <span style={{ display: 'block', fontSize: '0.75rem', color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Total Time</span>
          <strong style={{ fontSize: '1.5rem', color: '#60a5fa' }}>{stats.time} ⏱️</strong>
        </div>
      </div>

      {/* The Central Consistency Heatmap Grid */}
      <WorkoutCalendarGrid workouts={workouts} onDeleteWorkout={handleDeleteWorkout} />
    </div>
  );
}