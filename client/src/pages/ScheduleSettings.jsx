import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchWithAuth } from '../apiClient';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const DEFAULT_SPLIT = DAYS.map((day, index) => ({
  day_of_week: index,
  time_slot: 'AM',
  activity_type: 'lifting',
  routine_id: '',
  title: `${day} Workout`
}));

export default function ScheduleSettings() {
  const [schedulingMode, setSchedulingMode] = useState('CONSTRAINED');
  const [weeklySplit, setWeeklySplit] = useState(DEFAULT_SPLIT);
  const [routines, setRoutines] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchWithAuth('/api/v1/routines').then((res) => res.json()),
      fetchWithAuth('/api/v1/schedule/preferences').then((res) => res.json())
    ])
      .then(([routinesData, prefData]) => {
        if (Array.isArray(routinesData)) setRoutines(routinesData);

        if (prefData?.scheduling_mode) setSchedulingMode(prefData.scheduling_mode);

        if (Array.isArray(prefData?.weekly_split) && prefData.weekly_split.length > 0) {
          setWeeklySplit(prefData.weekly_split);
        }
      })
      .catch((err) => console.error('Error loading schedule preferences:', err))
      .finally(() => setLoading(false));
  }, []);

  const getActivityIcon = (type) => {
    switch (type) {
      case 'swim': return '🏊';
      case 'lifting': return '🏋️';
      case 'cardio': return '🏃';
      case 'rest': return '🧘';
      default: return '💪';
    }
  };

  const handleSlotChange = (index, field, value) => {
    const updated = [...weeklySplit];
    updated[index] = { ...updated[index], [field]: value };
    setWeeklySplit(updated);
  };

  const addSlotForDay = (dayIndex) => {
    setWeeklySplit((prev) => [
      ...prev,
      {
        day_of_week: dayIndex,
        time_slot: 'PM',
        activity_type: 'swim',
        routine_id: '',
        title: `${DAYS[dayIndex]} PM Session`
      }
    ]);
  };

  const removeSlot = (indexToRemove) => {
    setWeeklySplit((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetchWithAuth('/api/v1/schedule/preferences', {
        method: 'PUT',
        body: JSON.stringify({
          scheduling_mode: schedulingMode,
          weekly_split: weeklySplit
        })
      });

      if (res.ok) {
        alert('Schedule preferences saved successfully!');
      } else {
        alert('Failed to save preferences.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ color: '#888', padding: '20px' }}>Loading Schedule Config...</p>;

  const selectedDaySlots = weeklySplit
    .map((slot, originalIdx) => ({ ...slot, originalIdx }))
    .filter((slot) => slot.day_of_week === selectedDay);

  return (
    <div className="app-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', boxSizing: 'border-box' }}>
      {/* --- HEADER --- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link to="/" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '1.2rem' }}>← Back</Link>
        <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#fff' }}>Schedule Preferences</h1>
      </div>

      {/* --- ENGINE MODE SELECTOR --- */}
      <div style={{ background: '#2d2d34', padding: '16px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #3f3f46' }}>
        <h2 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#fff' }}>⚙️ Rollover Engine Strategy</h2>
        <p style={{ color: '#a1a1aa', fontSize: '0.8rem', marginBottom: '14px' }}>
          Choose how the calendar responds when you skip or miss a scheduled workout session.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { mode: 'STATIC', label: '1. Static (Strict Calendar)', desc: 'Missed days stay marked as missed. Future workouts do not move.' },
            { mode: 'PIPELINE', label: '2. Pipeline (Full Rollover)', desc: 'Sequence priority. Missed workouts push all upcoming sessions down by 1 day.' },
            { mode: 'CONSTRAINED', label: '3. Constrained (Smart Category Shift)', desc: 'Shifts missed workouts to your next designated slot of the same activity type.' }
          ].map(({ mode, label, desc }) => (
            <label
              key={mode}
              style={{
                display: 'block',
                padding: '10px 12px',
                borderRadius: '8px',
                background: schedulingMode === mode ? '#1e293b' : '#222226',
                border: schedulingMode === mode ? '1px solid #38bdf8' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              <input
                type="radio"
                name="schedulingMode"
                value={mode}
                checked={schedulingMode === mode}
                onChange={(e) => setSchedulingMode(e.target.value)}
                style={{ marginRight: '10px' }}
              />
              <strong style={{ color: '#fff', fontSize: '0.9rem' }}>{label}</strong>
              <p style={{ margin: '2px 0 0 24px', fontSize: '0.78rem', color: '#a1a1aa' }}>{desc}</p>
            </label>
          ))}
        </div>
      </div>

      {/* --- 7-DAY SELECTOR TILES GRID --- */}
      <h2 style={{ fontSize: '1.1rem', color: '#fff', marginBottom: '12px' }}>🗓️ Weekly Routine Layout</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '16px' }}>
        {DAYS.map((dayName, idx) => {
          const isSelected = selectedDay === idx;
          const slotsForDay = weeklySplit.filter((s) => s.day_of_week === idx);

          return (
            <button
              key={dayName}
              onClick={() => setSelectedDay(idx)}
              style={{
                background: isSelected ? '#1e293b' : '#2d2d34',
                border: isSelected ? '2px solid #38bdf8' : '1px solid #3f3f46',
                borderRadius: '10px',
                padding: '10px 2px',
                color: '#fff',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s ease'
              }}
            >
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: isSelected ? '#38bdf8' : '#a1a1aa' }}>
                {SHORT_DAYS[idx]}
              </span>
              <div style={{ minHeight: '18px', display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {slotsForDay.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>🧘</span>
                ) : (
                  slotsForDay.map((s, i) => (
                    <span key={i} style={{ fontSize: '0.8rem' }}>{getActivityIcon(s.activity_type)}</span>
                  ))
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* --- ACTIVE DAY EDITOR PANEL --- */}
      <div style={{ background: '#2d2d34', padding: '16px', borderRadius: '12px', border: '1px solid #3f3f46', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#38bdf8', fontSize: '1.2rem' }}>{DAYS[selectedDay]}</h3>
            <span style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>
              {selectedDaySlots.length} Session{selectedDaySlots.length !== 1 ? 's' : ''} Configured
            </span>
          </div>
          <button
            onClick={() => addSlotForDay(selectedDay)}
            style={{
              background: '#38bdf8',
              color: '#0f172a',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}
          >
            ＋ Add Session
          </button>
        </div>

        {selectedDaySlots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: '#a1a1aa', fontSize: '0.9rem' }}>
            🧘 Rest Day / No workouts scheduled for {DAYS[selectedDay]}.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {selectedDaySlots.map((slot) => (
              <div
                key={slot.originalIdx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  background: '#1e1e24',
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #2d2d34'
                }}
              >
                {/* LINE 1: Time Slot + Activity Type + Delete Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <select
                      value={slot.time_slot}
                      onChange={(e) => handleSlotChange(slot.originalIdx, 'time_slot', e.target.value)}
                      style={{
                        background: '#2d2d34',
                        color: '#fff',
                        border: '1px solid #444',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                      <option value="ANY">ANY</option>
                    </select>

                    <select
                      value={slot.activity_type}
                      onChange={(e) => handleSlotChange(slot.originalIdx, 'activity_type', e.target.value)}
                      style={{
                        background: '#2d2d34',
                        color: '#fff',
                        border: '1px solid #444',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        flex: 1
                      }}
                    >
                      <option value="lifting">🏋️ Lifting</option>
                      <option value="swim">🏊 Swim</option>
                      <option value="cardio">🏃 Cardio</option>
                      <option value="rest">🧘 Rest</option>
                    </select>
                  </div>

                  <button
                    onClick={() => removeSlot(slot.originalIdx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '1.1rem',
                      padding: '4px 8px'
                    }}
                    title="Remove Session"
                  >
                    🗑️
                  </button>
                </div>

                {/* LINE 2: Session Title Input + Template Selector (Stacked Responsive Grid) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    value={slot.title}
                    placeholder="Title (e.g. Upper A)"
                    onChange={(e) => handleSlotChange(slot.originalIdx, 'title', e.target.value)}
                    style={{
                      background: '#2d2d34',
                      color: '#fff',
                      border: '1px solid #444',
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      minWidth: 0
                    }}
                  />

                  <select
                    value={slot.routine_id || ''}
                    onChange={(e) => handleSlotChange(slot.originalIdx, 'routine_id', e.target.value || null)}
                    style={{
                      background: '#2d2d34',
                      color: '#fff',
                      border: '1px solid #444',
                      padding: '8px',
                      borderRadius: '6px',
                      fontSize: '0.85rem',
                      width: '100%',
                      boxSizing: 'border-box',
                      minWidth: 0
                    }}
                  >
                    <option value="">(No Template)</option>
                    {routines.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* --- SAVE PREFERENCES BUTTON --- */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          backgroundColor: '#10b981',
          color: '#fff',
          padding: '14px',
          borderRadius: '10px',
          border: 'none',
          fontWeight: 'bold',
          fontSize: '1rem',
          cursor: saving ? 'not-allowed' : 'pointer',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
        }}
      >
        {saving ? 'Saving Preferences...' : 'Save Schedule Preferences'}
      </button>
    </div>
  );
}