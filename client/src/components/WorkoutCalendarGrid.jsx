import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchWithAuth } from '../apiClient';

const getLocalDateStr = (dateInput = new Date()) => {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput).split('T')[0];
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function WorkoutCalendarGrid({ workouts = [], onDeleteWorkout }) {
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());
  const [scheduledWorkouts, setScheduledWorkouts] = useState([]);
  
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    return sessionStorage.getItem('selectedWorkoutDate') || null;
  });

  const todayStr = getLocalDateStr(new Date());

  useEffect(() => {
    if (selectedDateStr) {
      sessionStorage.setItem('selectedWorkoutDate', selectedDateStr);
    } else {
      sessionStorage.removeItem('selectedWorkoutDate');
    }
  }, [selectedDateStr]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  useEffect(() => {
    const padMonth = String(currentMonth + 1).padStart(2, '0');
    const firstDayStr = `${currentYear}-${padMonth}-01`;
    const lastDayStr = `${currentYear}-${padMonth}-${String(daysInMonth).padStart(2, '0')}`;

    fetchWithAuth(`/api/v1/schedule/calendar?start_date=${firstDayStr}&end_date=${lastDayStr}&today=${todayStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setScheduledWorkouts(data);
      })
      .catch((err) => console.error('Error fetching calendar schedule:', err));
  }, [currentYear, currentMonth, daysInMonth, todayStr]);

  const completedMap = workouts.reduce((map, w) => {
    if (!w.started_at) return map;
    const dateStr = getLocalDateStr(w.started_at);
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(w);
    return map;
  }, {});

  const scheduledMap = scheduledWorkouts.reduce((map, s) => {
    if (!s.scheduled_date || s.status === 'skipped') return map;
    const dateStr = String(s.scheduled_date).split('T')[0];
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(s);
    return map;
  }, {});

  const handlePrevMonth = () => setViewDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setViewDate(new Date(currentYear, currentMonth + 1, 1));

  const getActivityIcon = (type) => {
    switch (type) {
      case 'swim': return '🏊';
      case 'lifting': return '🏋️';
      case 'cardio': return '🏃';
      case 'rest': return '🧘';
      default: return '💪';
    }
  };

  const calendarCells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ isPadding: true, key: `pad-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const padDay = String(day).padStart(2, '0');
    const padMonth = String(currentMonth + 1).padStart(2, '0');
    const dateStr = `${currentYear}-${padMonth}-${padDay}`;
    
    calendarCells.push({
      isPadding: false,
      dayNumber: day,
      dateStr: dateStr,
      key: dateStr
    });
  }

  const selectedCompleted = selectedDateStr ? completedMap[selectedDateStr] || [] : [];
  const selectedScheduled = selectedDateStr ? scheduledMap[selectedDateStr] || [] : [];

  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div style={{ background: '#18181b', padding: '20px', borderRadius: '12px', color: '#fff' }}>
      
      {/* Calendar Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>
          {monthNames[currentMonth]} {currentYear}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrevMonth} style={{ background: '#27272a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>◀</button>
          <button onClick={handleNextMonth} style={{ background: '#27272a', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>▶</button>
        </div>
      </div>

      {/* Legend Indicator Bar */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: '#a1a1aa', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '3px' }}></span>
          <span>Logged Workout</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '3px' }}></span>
          <span>Planned Schedule</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', backgroundColor: '#27272a', borderRadius: '3px' }}></span>
          <span>Rest / Off</span>
        </div>
      </div>

      {/* Week Day Header */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        textAlign: 'center', 
        fontWeight: '600', 
        fontSize: '0.8rem', 
        color: '#71717a', 
        marginBottom: '8px' 
      }}>
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>

      {/* Main Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px',
        marginBottom: '20px'
      }}>
        {calendarCells.map((cell) => {
          if (cell.isPadding) return <div key={cell.key} />;

          const dayCompleted = completedMap[cell.dateStr] || [];
          const dayScheduled = scheduledMap[cell.dateStr] || [];
          
          const hasCompleted = dayCompleted.length > 0;
          const hasScheduled = dayScheduled.length > 0;
          const isSelected = selectedDateStr === cell.dateStr;
          const isToday = cell.dateStr === todayStr;

          // Clean, solid block colors
          let bgColor = '#27272a'; // Default Rest Day
          if (hasCompleted) {
            bgColor = '#10b981'; // Solid Emerald
          } else if (hasScheduled) {
            bgColor = '#3b82f6'; // Solid Blue
          }

          let borderStyle = '2px solid transparent';
          if (isToday) borderStyle = '2px solid #f59e0b'; // Amber ring for TODAY
          if (isSelected) borderStyle = '2px solid #ffffff'; // White ring for SELECTED

          return (
            <button
              key={cell.key}
              onClick={() => setSelectedDateStr(prev => prev === cell.dateStr ? null : cell.dateStr)}
              style={{
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                backgroundColor: bgColor,
                border: borderStyle,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s ease',
                transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 12px rgba(0, 0, 0, 0.4)' : 'none'
              }}
            >
              {cell.dayNumber}
            </button>
          );
        })}
      </div>

      {/* Detail Drawer */}
      <div style={{ borderTop: '1px solid #27272a', paddingTop: '16px', minHeight: '70px' }}>
        {!selectedDateStr ? (
          <p style={{ color: '#71717a', textAlign: 'center', fontSize: '0.85rem' }}>
            Tap any date cell to view sessions or logged workouts.
          </p>
        ) : (selectedCompleted.length === 0 && selectedScheduled.length === 0) ? (
          <p style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>
            No workouts scheduled on <strong>{selectedDateStr}</strong>. Rest Day 🛌
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Planned Sessions */}
            {selectedScheduled.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.8rem', color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  📅 Planned for {selectedDateStr}
                </h4>
                {selectedScheduled.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justify: 'space-between',
                      alignItems: 'center',
                      background: '#27272a',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      marginBottom: '6px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '1.1rem' }}>{getActivityIcon(item.activity_type)}</span>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{item.title}</strong>
                        {item.routine_name && (
                          <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#a1a1aa' }}>
                            Routine: {item.routine_name}
                          </p>
                        )}
                      </div>
                    </div>

                    {item.routine_id ? (
                      <button
                        onClick={() => navigate(`/workout-session?routineId=${item.routine_id}`)}
                        style={{
                          background: '#3b82f6',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontWeight: '600',
                          fontSize: '0.8rem',
                          cursor: 'pointer'
                        }}
                      >
                        ▶ Start
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Planned</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Completed Workouts */}
            {selectedCompleted.length > 0 && (
              <div>
                <h4 style={{ fontSize: '0.8rem', color: '#34d399', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  ✅ Logged Session
                </h4>
                {selectedCompleted.map((workout) => (
                  <div 
                    key={workout.id} 
                    style={{ 
                      display: 'flex', 
                      justify: 'space-between', 
                      alignItems: 'center',
                      background: '#27272a',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      marginBottom: '6px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600' }}>{workout.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#10b981', background: '#09090b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                          ⏱️ {formatDuration(workout.duration_seconds)}
                        </span>
                      </div>
                      {workout.notes && <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '4px 0 0 0' }}>📝 {workout.notes}</p>}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Link to={`/workouts/${workout.id}`} style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '0.85rem' }}>
                        Details
                      </Link>
                      <button
                        onClick={() => onDeleteWorkout(workout.id)}
                        style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}