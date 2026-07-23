import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import WorkoutCalendarGrid from '../components/WorkoutCalendarGrid';
import { fetchWithAuth } from '../apiClient';

export default function Dashboard() {
  const navigate = useNavigate();
  const [workouts, setWorkouts] = useState([]);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // Fetch past workouts AND today's scheduled sessions in parallel
    Promise.all([
      fetchWithAuth('/api/v1/workouts').then((res) => res.json()),
      fetchWithAuth(`/api/v1/schedule/calendar?start_date=${todayStr}&end_date=${todayStr}`).then((res) => res.json())
    ])
      .then(([workoutsData, scheduleData]) => {
        if (Array.isArray(workoutsData)) {
          setWorkouts(workoutsData);
        } else {
          setWorkouts([]);
        }

        if (Array.isArray(scheduleData)) {
          setTodaySchedule(scheduleData);
        } else {
          setTodaySchedule([]);
        }
      })
      .catch((err) => {
        console.error('Dashboard fetch error:', err);
        setWorkouts([]);
        setTodaySchedule([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [todayStr]);

  const handleDeleteWorkout = async (workoutId) => {
    try {
      const response = await fetchWithAuth(`/api/v1/workouts/${workoutId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error("Failed to delete the workout record.");
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    } catch (error) {
      console.error('Deletion error:', error);
      alert('Could not delete workout. Verify backend is running.');
    }
  };

  const getWeeklyStats = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const weeklyWorkouts = (Array.isArray(workouts) ? workouts : []).filter(w => {
      if (!w || !w.started_at) return false;
      const wDate = new Date(w.started_at);
      return wDate >= sevenDaysAgo && wDate <= now;
    });

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

  const getActivityIcon = (type) => {
    switch (type) {
      case 'swim': return '🏊';
      case 'lifting': return '🏋️‍♂️';
      case 'cardio': return '🏃';
      case 'rest': return '🧘';
      default: return '💪';
    }
  };

  if (loading) return <p style={{ color: '#888', padding: '20px' }}>Loading Dashboard...</p>;

  const stats = getWeeklyStats();

  return (
    <div className="app-container">
      {/* ⚙️ Header with Schedule & Account Links */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Jega</h1>
          <span className="subtitle">Dashboard</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Link to="/schedule-settings" style={{ fontSize: '1.4rem', textDecoration: 'none' }} title="Schedule Settings">
            🗓️
          </Link>
          <Link to="/account" style={{ fontSize: '1.4rem', textDecoration: 'none' }} title="Account Settings">
            ⚙️
          </Link>
        </div>
      </header>

      {/* 📅 TODAY'S AGENDA WIDGET */}
      <div style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        padding: '20px',
        borderRadius: '16px',
        marginBottom: '20px',
        border: '1px solid #334155',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📅 Today's Focus
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {todaySchedule.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <p style={{ margin: '0 0 10px 0', color: '#cbd5e1', fontSize: '0.95rem' }}>
              🧘 Rest Day / No workouts scheduled for today.
            </p>
            <Link
              to="/schedule-settings"
              style={{ fontSize: '0.8rem', color: '#38bdf8', textDecoration: 'underline' }}
            >
              Configure weekly schedule split →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {todaySchedule.map((session) => (
              <div
                key={session.id}
                style={{
                  display: 'flex',
                  justify: 'space-between',
                  alignItems: 'center',
                  background: '#0f172a',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  border: '1px solid #1e293b'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '1.4rem' }}>{getActivityIcon(session.activity_type)}</span>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 'bold', textTransform: 'uppercase' }}>
                      {session.time_slot} SESSION
                    </div>
                    <strong style={{ color: '#f8fafc', fontSize: '1rem' }}>{session.title}</strong>
                    {session.routine_name && (
                      <span style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8' }}>
                        Template: {session.routine_name}
                      </span>
                    )}
                  </div>
                </div>

                {session.routine_id ? (
                  <button
                    onClick={() => navigate(`/focus/${session.routine_id}`)}
                    style={{
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      padding: '8px 14px',
                      borderRadius: '6px',
                      fontWeight: 'bold',
                      fontSize: '0.85rem',
                      cursor: 'pointer'
                    }}
                  >
                    Start ▶
                  </button>
                ) : (
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Custom Log</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🚀 QUICK NAVIGATION CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <Link to="/templates" style={{ 
          background: '#2d2d34', padding: '16px', borderRadius: '12px', textDecoration: 'none', color: '#fff', display: 'block' 
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>🏋️‍♂️ Templates</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#a1a1aa' }}>Launch or edit routines</p>
        </Link>

        <Link to="/schedule-settings" style={{ 
          background: '#2d2d34', padding: '16px', borderRadius: '12px', textDecoration: 'none', color: '#fff', display: 'block' 
        }}>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem' }}>🗓️ Schedule</h3>
          <p style={{ margin: 0, fontSize: '0.75rem', color: '#a1a1aa' }}>Set split & rollover rules</p>
        </Link>
      </div>

      {/* 📊 PAST 7 DAYS STATS */}
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

      {/* 🗓️ WORKOUT CALENDAR GRID */}
      <WorkoutCalendarGrid workouts={workouts} onDeleteWorkout={handleDeleteWorkout} />
    </div>
  );
}