// src/components/workout/CircuitCard.jsx
import { useState, useEffect, useRef } from 'react';
import { fetchWithAuth } from '../../apiClient';
import { usePhaseTimer } from '../../hooks/usePhaseTimer';
import { formatRestDisplay } from '../../utils/setDisplay';
import { toBaseKg, toDisplayWeight } from '../../utils/unitConverter';

export default function CircuitCard({ unit, workoutId, userUnit, onCircuitComplete, circuitState, updateCircuitState }) {
  const {
    exercises,
    rounds,
    round_rest_seconds: roundRest,
    // auto_advance_round removed – derived from last exercise now
  } = unit;

  const {
    currentRound = 1,
    currentStationIndex = 0,
    phaseState = 'pre',
    loggedSets = [],
  } = circuitState || {};

  const totalStations = exercises.length;
  const currentExercise = exercises[currentStationIndex];
  const lastExercise = exercises[totalStations - 1]; // gates round auto-start

  // Ref to remember if the transition to the current station was automatic
  // (via auto_advance) or manual (user tap). Only auto transitions auto-start timers.
  const autoStartRef = useRef(false);

  // Timer hook
  const {
    timeLeft,
    isRunning,
    startPhaseTimer,
    addTime,
    skip,
    pause,
    resume,
  } = usePhaseTimer({
    onPhaseComplete: (completedPhase) => {
      if (completedPhase === 'work') {
        autoLogPlannedSet();
        startRestPhase();
      } else if (completedPhase === 'rest') {
        handleStationComplete();
      } else if (completedPhase === 'round_rest') {
        prepareNextRound();
      }
    },
  });

  // Stopwatch state
  const [stopwatchRunning, setStopwatchRunning] = useState(false);
  const [stopwatchElapsed, setStopwatchElapsed] = useState(0);
  const stopwatchInterval = useRef(null);

  // Manual‑log inputs
  const [actualWeight, setActualWeight] = useState('');
  const [actualReps, setActualReps] = useState('');
  const [actualTimeMin, setActualTimeMin] = useState('');
  const [actualTimeSec, setActualTimeSec] = useState('');
  const [actualDistance, setActualDistance] = useState('');
  const [actualRpe, setActualRpe] = useState('');

  // Seed manual inputs from planned set when station/round changes
  useEffect(() => {
    const planned = currentExercise?.sets?.[0];
    setActualWeight(planned?.weight != null ? String(toDisplayWeight(planned.weight, userUnit)) : '');
    setActualReps(planned?.reps != null ? String(planned.reps) : '');
    setActualTimeMin(planned?.time_minutes != null ? String(planned.time_minutes) : '');
    setActualTimeSec(planned?.time_seconds != null ? String(planned.time_seconds) : '');
    setActualDistance(planned?.distance != null ? String(planned.distance) : '');
    setActualRpe('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStationIndex, currentRound]);

  // Persist state to parent
  useEffect(() => {
    updateCircuitState?.({
      currentRound,
      currentStationIndex,
      phaseState,
      loggedSets,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, currentStationIndex, phaseState, loggedSets]);

  // --- Helpers ---
  const autoLogPlannedSet = async () => {
    if (!currentExercise || !workoutId) return;
    const plannedSet = currentExercise.sets?.[0];
    if (!plannedSet) return;
    const baseKg = plannedSet.weight != null ? toBaseKg(plannedSet.weight, userUnit) : 0;
    const setNumber = (currentRound - 1) * totalStations + currentStationIndex + 1;

    try {
      const res = await fetchWithAuth(`/api/v1/workouts/${workoutId}/sets`, {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: currentExercise.exercise_id,
          set_number: setNumber,
          actual_weight_kg: baseKg,
          actual_reps: plannedSet.reps || 0,
          time_minutes: plannedSet.time_minutes || 0,
          time_seconds: plannedSet.time_seconds || 0,
          distance: plannedSet.distance || 0,
          rpe: null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateCircuitState({ loggedSets: [...loggedSets, data] });
      }
    } catch (err) {
      console.error('Auto-log failed', err);
    }
  };

  const startRestPhase = () => {
    const restSec = currentExercise?.rest_seconds ?? 90;
    startPhaseTimer('rest', restSec);
    updateCircuitState({ phaseState: 'rest' });
  };

  const handleStationComplete = () => {
    if (!currentExercise?.auto_advance) {
      updateCircuitState({ phaseState: 'rest_manual_advance' });
      return;
    }
    autoStartRef.current = true; // mark automatic transition
    advanceStation();
  };

  const advanceStation = () => {
    if (currentStationIndex < totalStations - 1) {
      updateCircuitState({
        currentStationIndex: currentStationIndex + 1,
        phaseState: 'active',
      });
    } else {
      // End of round
      if (currentRound < rounds) {
        if (roundRest > 0) {
          startPhaseTimer('round_rest', roundRest);
          updateCircuitState({ phaseState: 'round_rest' });
        } else {
          prepareNextRound();
        }
      } else {
        updateCircuitState({ phaseState: 'completed' });
      }
    }
  };

  const prepareNextRound = () => {
    const shouldAutoStart = !!lastExercise?.auto_advance;
    autoStartRef.current = shouldAutoStart;
    updateCircuitState({
      currentRound: currentRound + 1,
      currentStationIndex: 0,
      phaseState: shouldAutoStart ? 'active' : 'round_pending',
    });
  };

  // Station start effect – only auto-starts when we arrived automatically
  useEffect(() => {
    if (phaseState !== 'active' || !currentExercise) return;
    if (!autoStartRef.current) return; // manual entry, do nothing
    autoStartRef.current = false; // consume the flag

    if (currentExercise.timer_mode === 'countdown' && currentExercise.work_seconds) {
      startPhaseTimer('work', currentExercise.work_seconds);
      updateCircuitState({ phaseState: 'work' });
    } else if (currentExercise.timer_mode === 'stopwatch') {
      startStopwatch();
    }
    // manual mode: nothing to auto-start, form is already shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phaseState, currentStationIndex, currentRound]);

  // --- Stopwatch controls ---
  const startStopwatch = () => {
    setStopwatchRunning(true);
    setStopwatchElapsed(0);
    stopwatchInterval.current = setInterval(() => {
      setStopwatchElapsed((prev) => prev + 1);
    }, 1000);
  };

  const stopStopwatch = async () => {
    clearInterval(stopwatchInterval.current);
    setStopwatchRunning(false);
    const mins = Math.floor(stopwatchElapsed / 60);
    const secs = stopwatchElapsed % 60;
    const plannedSet = currentExercise?.sets?.[0];
    const baseKg = plannedSet?.weight != null ? toBaseKg(plannedSet.weight, userUnit) : 0;
    try {
      const res = await fetchWithAuth(`/api/v1/workouts/${workoutId}/sets`, {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: currentExercise.exercise_id,
          set_number: (currentRound - 1) * totalStations + currentStationIndex + 1,
          actual_weight_kg: baseKg,
          actual_reps: plannedSet?.reps || 0,
          time_minutes: mins,
          time_seconds: secs,
          distance: plannedSet?.distance || 0,
          rpe: null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateCircuitState({ loggedSets: [...loggedSets, data] });
      }
    } catch (err) {
      console.error(err);
    }
    startRestPhase();
  };

  // --- Manual log ---
  const handleManualLog = async (e) => {
    e.preventDefault();
    if (!currentExercise || !workoutId) return;
    const baseKg = actualWeight !== '' ? toBaseKg(Number(actualWeight), userUnit) : 0;
    const setNumber = (currentRound - 1) * totalStations + currentStationIndex + 1;
    try {
      const res = await fetchWithAuth(`/api/v1/workouts/${workoutId}/sets`, {
        method: 'POST',
        body: JSON.stringify({
          exercise_id: currentExercise.exercise_id,
          set_number: setNumber,
          actual_weight_kg: baseKg,
          actual_reps: actualReps !== '' ? Number(actualReps) : 0,
          time_minutes: actualTimeMin !== '' ? Number(actualTimeMin) : 0,
          time_seconds: actualTimeSec !== '' ? Number(actualTimeSec) : 0,
          distance: actualDistance !== '' ? Number(actualDistance) : 0,
          rpe: actualRpe !== '' ? Number(actualRpe) : null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        updateCircuitState({ loggedSets: [...loggedSets, data] });
      }
    } catch (err) {
      console.error('Manual log failed', err);
    }
    startRestPhase();
  };

  // --- Manual advance (after rest when auto_advance off) ---
  const handleManualAdvance = () => {
    autoStartRef.current = false; // explicit tap, no auto-start
    advanceStation();
  };

  // --- Start screen (shared) ---
  const renderStartScreen = (heading, onStart) => (
    <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #eab308', borderRadius: '12px', padding: '20px', flex: '1' }}>
      <h2 style={{ color: '#eab308', margin: '0 0 16px 0' }}>{heading}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {exercises.map((ex, idx) => {
          const set = ex.sets?.[0];
          const displayWeight = set?.weight != null ? toDisplayWeight(set.weight, userUnit) : 0;
          return (
            <div key={idx} style={{ backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '12px', display: 'flex', justifyContent: 'space-between', color: '#fff' }}>
              <span style={{ fontWeight: 'bold' }}>{ex.name}</span>
              <span style={{ color: '#a1a1aa' }}>
                {ex.tracking_type === 'weight_reps' && `${displayWeight} ${userUnit} × ${set?.reps || 0} reps`}
                {ex.tracking_type === 'time' && `${set?.time_minutes || 0}m ${set?.time_seconds || 0}s`}
                {ex.tracking_type === 'bodyweight_reps' && `${set?.reps || 0} reps`}
                {ex.tracking_type === 'time_weight' && `${displayWeight} ${userUnit} × ${set?.time_minutes || 0}m ${set?.time_seconds || 0}s`}
                {ex.tracking_type === 'distance_time' && `${set?.distance || 0} mi in ${set?.time_minutes || 0}m ${set?.time_seconds || 0}s`}
                {' '}— {ex.timer_mode}
              </span>
            </div>
          );
        })}
      </div>
      <button onClick={onStart} style={{ width: '100%', padding: '16px', backgroundColor: '#eab308', color: '#111', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.2rem', cursor: 'pointer' }}>
        Start Circuit
      </button>
    </div>
  );

  // --- Pre‑start ---
  if (phaseState === 'pre') {
    return renderStartScreen(
      `🔄 Circuit — ${rounds} round${rounds > 1 ? 's' : ''}`,
      () => { autoStartRef.current = false; updateCircuitState({ phaseState: 'active' }); }
    );
  }

  // --- Round pending ---
  if (phaseState === 'round_pending') {
    return renderStartScreen(
      `🔄 Round ${currentRound}/${rounds}`,
      () => { autoStartRef.current = false; updateCircuitState({ phaseState: 'active' }); }
    );
  }

  // --- Completed ---
  if (phaseState === 'completed') {
    return (
      <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #4ade80', borderRadius: '12px', padding: '20px', flex: '1', textAlign: 'center' }}>
        <h2 style={{ color: '#4ade80' }}>✅ Circuit Complete!</h2>
        <p style={{ color: '#fff' }}>{loggedSets.length} sets logged</p>
        <button onClick={onCircuitComplete} style={{ marginTop: '16px', backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
          Continue
        </button>
      </div>
    );
  }

  // --- Active / rest / work / manual ---
  const plannedSet = currentExercise?.sets?.[0];
  const displayWeight = plannedSet?.weight != null ? toDisplayWeight(plannedSet.weight, userUnit) : '—';
  const isWaitingToAdvance = phaseState === 'rest_manual_advance';

  return (
    <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #eab308', borderRadius: '12px', padding: '20px', flex: '1' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <span style={{ color: '#eab308', fontWeight: 'bold' }}>Round {currentRound}/{rounds}</span>
      </div>

      <div style={{ backgroundColor: '#111', border: '1px solid #eab308', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ color: '#fff', margin: '0 0 8px 0' }}>{currentExercise?.name}</h3>
        <div style={{ color: '#a1a1aa', marginBottom: '12px', fontSize: '0.9rem' }}>
          {currentExercise?.tracking_type === 'weight_reps' && `Target: ${displayWeight} ${userUnit} × ${plannedSet?.reps || 0} reps`}
          {currentExercise?.tracking_type === 'time' && `Target: ${plannedSet?.time_minutes || 0}m ${plannedSet?.time_seconds || 0}s`}
          {currentExercise?.tracking_type === 'bodyweight_reps' && `Target: ${plannedSet?.reps || 0} reps`}
          {currentExercise?.tracking_type === 'time_weight' && `Target: ${displayWeight} ${userUnit} × ${plannedSet?.time_minutes || 0}m ${plannedSet?.time_seconds || 0}s`}
          {currentExercise?.tracking_type === 'distance_time' && `Target: ${plannedSet?.distance || 0} mi in ${plannedSet?.time_minutes || 0}m ${plannedSet?.time_seconds || 0}s`}
        </div>

        {/* Rest / Round rest / Waiting to advance */}
        {(phaseState === 'rest' || phaseState === 'round_rest' || isWaitingToAdvance) && (
          <div style={{ textAlign: 'center' }}>
            {isWaitingToAdvance ? (
              <>
                <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>Rest Complete</div>
                <p style={{ color: '#888' }}>Ready when you are</p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981' }}>
                  {formatRestDisplay(timeLeft)}
                </div>
                <p style={{ color: '#888' }}>
                  {phaseState === 'round_rest' ? 'Round Rest' : 'Rest'}
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                  {!isRunning ? (
                    <button onClick={resume} style={actionBtn('#2563eb')}>Resume</button>
                  ) : (
                    <button onClick={pause} style={actionBtn('#ef4444')}>Pause</button>
                  )}
                  <button onClick={skip} style={actionBtn('#2d2d2d')}>Skip</button>
                  <button onClick={() => addTime(15)} style={actionBtn('#2d2d2d')}>+15s</button>
                </div>
              </>
            )}
            {isWaitingToAdvance && (
              <button onClick={handleManualAdvance} style={{ ...actionBtn('#eab308'), marginTop: '12px' }}>
                Next Station ➔
              </button>
            )}
          </div>
        )}

        {/* Work / Stopwatch / Manual (only when not in rest) */}
        {phaseState !== 'rest' && phaseState !== 'round_rest' && !isWaitingToAdvance && (
          <>
            {currentExercise?.timer_mode === 'countdown' && (
              <div style={{ textAlign: 'center' }}>
                {phaseState === 'work' ? (
                  <>
                    <div style={{ fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981' }}>
                      {formatRestDisplay(timeLeft)}
                    </div>
                    <p style={{ color: '#888' }}>Work</p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      {!isRunning ? (
                        <button onClick={resume} style={actionBtn('#2563eb')}>Resume</button>
                      ) : (
                        <button onClick={pause} style={actionBtn('#ef4444')}>Pause</button>
                      )}
                      <button onClick={skip} style={actionBtn('#2d2d2d')}>Skip Work</button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => {
                    startPhaseTimer('work', currentExercise.work_seconds);
                    updateCircuitState({ phaseState: 'work' });
                  }} style={actionBtn('#2563eb')}>
                    Start Work
                  </button>
                )}
              </div>
            )}

            {currentExercise?.timer_mode === 'stopwatch' && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 'bold', color: '#10b981' }}>
                  {formatRestDisplay(stopwatchElapsed)}
                </div>
                {!stopwatchRunning ? (
                  <button onClick={startStopwatch} style={actionBtn('#2563eb')}>Start</button>
                ) : (
                  <button onClick={stopStopwatch} style={actionBtn('#ef4444')}>Stop & Log</button>
                )}
              </div>
            )}

            {currentExercise?.timer_mode === 'manual' && (
              <form onSubmit={handleManualLog} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ color: '#a1a1aa', margin: 0, textAlign: 'center' }}>Perform the set, then log what you actually did.</p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {(currentExercise.tracking_type === 'weight_reps' || currentExercise.tracking_type === 'time_weight') && (
                    <input type="number" step="0.1" placeholder={userUnit} value={actualWeight}
                      onChange={(e) => setActualWeight(e.target.value)} style={manualInputStyle} />
                  )}
                  {(currentExercise.tracking_type === 'weight_reps' || currentExercise.tracking_type === 'bodyweight_reps') && (
                    <input type="number" placeholder="Reps" value={actualReps}
                      onChange={(e) => setActualReps(e.target.value)} style={manualInputStyle} />
                  )}
                  {(currentExercise.tracking_type === 'time' || currentExercise.tracking_type === 'time_weight' || currentExercise.tracking_type === 'distance_time') && (
                    <>
                      <input type="number" placeholder="Min" value={actualTimeMin}
                        onChange={(e) => setActualTimeMin(e.target.value)} style={manualInputStyle} />
                      <input type="number" placeholder="Sec" value={actualTimeSec}
                        onChange={(e) => setActualTimeSec(e.target.value)} style={manualInputStyle} />
                    </>
                  )}
                  {currentExercise.tracking_type === 'distance_time' && (
                    <input type="number" step="0.1" placeholder="Miles" value={actualDistance}
                      onChange={(e) => setActualDistance(e.target.value)} style={manualInputStyle} />
                  )}
                  <input type="number" min="1" max="10" placeholder="RPE" value={actualRpe}
                    onChange={(e) => setActualRpe(e.target.value)} style={manualInputStyle} />
                </div>
                <button type="submit" style={actionBtn('#4ade80')}>Log & Continue</button>
              </form>
            )}
          </>
        )}
      </div>

      {/* Timeline of stations */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: '8px', marginBottom: '16px' }}>
        {exercises.map((ex, idx) => {
          const isDone = idx < currentStationIndex || (idx === currentStationIndex && (phaseState === 'rest' || phaseState === 'round_rest' || isWaitingToAdvance));
          const isCurrent = idx === currentStationIndex;
          return (
            <div key={idx} style={{
              minWidth: '100px',
              padding: '8px',
              borderRadius: '8px',
              backgroundColor: isCurrent ? '#eab308' : isDone ? '#4ade80' : '#2d2d2d',
              color: isCurrent ? '#111' : '#fff',
              textAlign: 'center',
              fontSize: '0.8rem',
              opacity: isDone && !isCurrent ? 0.6 : 1,
              border: isCurrent ? '2px solid #fff' : 'none'
            }}>
              {ex.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const actionBtn = (bg) => ({
  backgroundColor: bg,
  color: '#fff',
  border: 'none',
  padding: '10px 16px',
  borderRadius: '8px',
  fontWeight: 'bold',
  cursor: 'pointer',
  marginTop: '8px',
});

const manualInputStyle = {
  flex: '1 1 70px',
  minWidth: '70px',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #2d2d2d',
  background: '#111',
  color: '#fff',
  textAlign: 'center',
};