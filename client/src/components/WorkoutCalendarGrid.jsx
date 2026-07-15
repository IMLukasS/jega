import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function WorkoutCalendarGrid({ workouts, onDeleteWorkout }) {
  // 1. Core State: Tracks which month/year the user is looking at
  const [viewDate, setViewDate] = useState(new Date());
  
  // 2. State Persistence: Initialize selected day from sessionStorage so it survives page reloads/navigation
  const [selectedDateStr, setSelectedDateStr] = useState(() => {
    return sessionStorage.getItem('selectedWorkoutDate') || null;
  });

  // Keep sessionStorage in sync whenever the selected day changes
  useEffect(() => {
    if (selectedDateStr) {
      sessionStorage.setItem('selectedWorkoutDate', selectedDateStr);
    } else {
      sessionStorage.removeItem('selectedWorkoutDate');
    }
  }, [selectedDateStr]);

  const currentYear = viewDate.getFullYear();
  const currentMonth = viewDate.getMonth(); // 0-11

  // 3. Calendar Math calculations
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Number of days in the current selected month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Day of the week the month starts on (0 = Sunday, 6 = Saturday) to pad the grid alignment
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();

  // 4. Map workouts by date string (YYYY-MM-DD) for O(1) grid checks
  const workoutMap = workouts.reduce((map, w) => {
    if (!w.started_at) return map;
    const dateStr = new Date(w.started_at).toISOString().split('T')[0];
    if (!map[dateStr]) map[dateStr] = [];
    map[dateStr].push(w);
    return map;
  }, {});

  // Month navigation logic
  const handlePrevMonth = () => {
    setViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  // Build the items inside the visual grid array
  const calendarCells = [];
  
  // Add empty padding slots for days of the week belonging to the prior month
  for (let i = 0; i < firstDayIndex; i++) {
    calendarCells.push({ isPadding: true, key: `pad-${i}` });
  }

  // Populate actual active calendar days
  for (let day = 1; day <= daysInMonth; day++) {
    // Generate clean padded strings matching DB stamps (e.g. "2026-07-05")
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

  const selectedWorkouts = selectedDateStr ? workoutMap[selectedDateStr] || [] : [];

  return (
    <div style={{ background: '#1e1e24', padding: '20px', borderRadius: '12px', color: '#fff' }}>
      
      {/* Calendar Header Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
          {monthNames[currentMonth]} {currentYear}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={handlePrevMonth} style={{ background: '#2d2d34', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>◀</button>
          <button onClick={handleNextMonth} style={{ background: '#2d2d34', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>▶</button>
        </div>
      </div>

      {/* Week Day Header Row labels */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        textAlign: 'center', 
        fontWeight: 'bold', 
        fontSize: '0.8rem', 
        color: '#a1a1aa', 
        marginBottom: '8px' 
      }}>
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>

      {/* Main Grid Block Layout */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: '8px',
        marginBottom: '24px'
      }}>
        {calendarCells.map((cell) => {
          if (cell.isPadding) {
            return <div key={cell.key} />; // Empty space placeholder
          }

          const dayWorkouts = workoutMap[cell.dateStr] || [];
          const hasWorkout = dayWorkouts.length > 0;
          const isSelected = selectedDateStr === cell.dateStr;

          // Compute style tokens based on context
          let bgColor = '#2d2d34';
          let textColor = '#fff';
          if (hasWorkout) bgColor = '#10b981'; // Green highlights for sessions logged
          if (isSelected) bgColor = '#007bff'; // Blue highlight locks on user click

          return (
            <button
            key={cell.key}
            onClick={() => {
                // 💡 Toggle Logic: If it's already selected, clear it (set to null). Otherwise, select it.
                setSelectedDateStr(prev => prev === cell.dateStr ? null : cell.dateStr);
            }}
            style={{
                aspectRatio: '1 / 1',
                borderRadius: '8px',
                backgroundColor: bgColor,
                color: textColor,
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.1s ease',
                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                boxShadow: isSelected ? '0 0 8px rgba(0, 123, 255, 0.5)' : 'none'
            }}
            >
            {cell.dayNumber}
            </button>
          );
        })}
      </div>

      {/* Dynamic Detail Drawer (Persists cleanly across data edits) */}
      <div style={{ borderTop: '1px solid #2d2d34', paddingTop: '16px', minHeight: '80px' }}>
        {!selectedDateStr ? (
          <p style={{ color: '#a1a1aa', textAlign: 'center', fontSize: '0.9rem' }}>
            Select a date cell above to review details or adjust log data history
          </p>
        ) : selectedWorkouts.length === 0 ? (
          <p style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>
            No workouts recorded on <strong>{selectedDateStr}</strong>. Rest day! 🛌
          </p>
        ) : (
          <div>
            <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>
              Sessions on {selectedDateStr}:
            </h4>
            {selectedWorkouts.map((workout) => (
              <div 
                key={workout.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: '#2d2d34',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  marginBottom: '8px'
                }}
              >
                <div>
                  <span style={{ fontWeight: '600' }}>{workout.name}</span>
                  {workout.notes && <p style={{ fontSize: '0.8rem', color: '#a1a1aa', margin: '4px 0 0 0' }}>📝 {workout.notes}</p>}
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Link 
                    to={`/workouts/${workout.id}`}
                    style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '0.85rem', fontWeight: '500' }}
                  >
                    View Details
                  </Link>

                  <button
                    onClick={() => {
                      if (window.confirm(`Are you sure you want to completely delete "${workout.name}"? This cannot be undone.`)) {
                        onDeleteWorkout(workout.id);
                        // 💡 FIX: Removed setSelectedDateStr(null) here!
                        // The details drawer stays up and immediately shows that the workout is gone.
                      }
                    }}
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      fontSize: '0.85rem'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}