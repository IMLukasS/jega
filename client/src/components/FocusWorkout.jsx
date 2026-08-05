import { useState, useCallback } from 'react';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { useSetLogger } from '../hooks/useSetLogger';
import { usePhaseTimer } from '../hooks/usePhaseTimer';
import { formatTime } from '../utils/setDisplay';
import ExerciseHeader from './workout/ExerciseHeader';
import CompletedSetsList from './workout/CompletedSetsList';
import GoalBanner from './workout/GoalBanner';
import SetInputForm from './workout/SetInputForm';
import FreestyleTypeSwitcher from './workout/FreestyleTypeSwitcher';
import RestTimerPanel from './workout/RestTimerPanel';
import WorkoutTimeline from './workout/WorkoutTimeline';
import CircuitCard from './workout/CircuitCard';

export default function FocusWorkout() {
  const {
    routine, workoutId,
    activeUnitIndex, setActiveUnitIndex,
    activeUnit, activeExercise,
    workoutUnits,
    elapsedSeconds,
    handleCancelWorkout, handleFinalizeWorkout,
    isFreestyle,
  } = useWorkoutSession();

  const userUnit = (localStorage.getItem('preferredUnit') || 'lbs').toLowerCase();
  const weightLabel = userUnit === 'kg' ? 'Kg' : 'Lbs';
  const [freestyleTrackingType, setFreestyleTrackingType] = useState('weight_reps');

  // Maintain state for active circuits by unit ID
  const [circuitStates, setCircuitStates] = useState({});
  const updateCircuitState = useCallback((unitId, state) => {
    // IMPORTANT: merge with the existing entry for this unit rather than
    // replacing it. CircuitCard calls this repeatedly with partial updates
    // (e.g. just { phaseState: 'rest' }); replacing the whole object was
    // silently wiping currentRound / currentStationIndex / loggedSets every
    // time a phase changed, and breaking "resume where I left off" when
    // switching between exercises.
    setCircuitStates(prev => ({
      ...prev,
      [unitId]: { ...(prev[unitId] || {}), ...state }
    }));
  }, []);

  if (isFreestyle && activeExercise) {
    activeExercise.tracking_type = freestyleTrackingType;
  }

  // Phase timer – no auto-advance callback
  const {
    phase,
    timeLeft: restTimeLeft,
    isRunning: isRestTimerRunning,
    startPhaseTimer,
    addTime: addRestTime,
    skip: skipRest,
    pause,
    resume,
  } = usePhaseTimer(); // no onPhaseComplete

  // Set logger hook
  const {
    weight, setWeight,
    reps, setReps,
    timeMin, setTimeMin,
    timeSec, setTimeSec,
    distance, setDistance,
    rpe, setRpe,
    editingSetIndex,
    currentCompletedSets,
    plannedSet,
    handleLogSet,
    handleStartEdit,
    handleCancelEdit,
    handleDeleteActiveSet,
    allCompletedSets,
  } = useSetLogger({
    activeExercise,
    activeExerciseIndex: activeUnitIndex,
    workoutId,
    userUnit,
    onSetLogged: () => {
      const restSec = activeExercise?.rest_seconds ?? 90;
      startPhaseTimer('rest', restSec);
    },
  });

  const isLastUnit = activeUnitIndex === workoutUnits.length - 1;
  const targetSetsCount = activeExercise?.sets ? activeExercise.sets.length : (activeExercise?.target_sets || 3);

  const handleNextExercise = () => {
    skipRest();
    if (!isLastUnit) {
      setActiveUnitIndex(prev => prev + 1);
    } else {
      handleFinalizeWorkout();
    }
  };

  const togglePauseRestTimer = () => {
    if (isRestTimerRunning) {
      pause();
    } else {
      resume();
    }
  };

  if (!routine || !workoutId) {
    return <div style={{ textAlign: 'center', marginTop: '50px', color: '#888' }}>Loading session...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '90vh', gap: '20px' }}>
      {/* Top header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>{routine.name}</h2>
          <div style={{ backgroundColor: '#2d2d34', color: '#10b981', padding: '4px 8px', borderRadius: '6px', fontWeight: '700', fontSize: '0.95rem', fontFamily: 'monospace' }}>
            ⏱️ {formatTime(elapsedSeconds)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={handleCancelWorkout} style={headerBtnStyle('#888')}>Cancel</button>
          <button onClick={handleFinalizeWorkout} style={headerBtnStyle('#10b981')}>Finish</button>
        </div>
      </div>

      {/* Main focus card (Conditioned on activeUnit.type) */}
      {activeUnit?.type === 'single' ? (
        <div style={{ backgroundColor: '#1e1e1e', border: '1px solid #2d2d2d', borderRadius: '12px', padding: '20px', flex: '1' }}>
          <ExerciseHeader name={activeExercise?.name} tags={activeExercise?.tags} targetSetsCount={targetSetsCount} />

          <CompletedSetsList sets={currentCompletedSets} trackingType={activeExercise?.tracking_type} userUnit={weightLabel} onEdit={handleStartEdit} />

          <GoalBanner plannedSet={plannedSet} trackingType={activeExercise?.tracking_type} userUnit={userUnit} />

          {isFreestyle && (
            <FreestyleTypeSwitcher currentType={freestyleTrackingType} onTypeChange={setFreestyleTrackingType} />
          )}

          <SetInputForm
            trackingType={activeExercise?.tracking_type}
            weight={weight} setWeight={setWeight}
            reps={reps} setReps={setReps}
            timeMin={timeMin} setTimeMin={setTimeMin}
            timeSec={timeSec} setTimeSec={setTimeSec}
            distance={distance} setDistance={setDistance}
            rpe={rpe} setRpe={setRpe}
            editingSetIndex={editingSetIndex}
            onSubmit={handleLogSet}
            onCancelEdit={handleCancelEdit}
            onDeleteSet={handleDeleteActiveSet}
            userUnit={weightLabel}
          />

          <button
            onClick={handleNextExercise}
            style={{ width: '100%', padding: '16px', backgroundColor: isLastUnit ? '#4ade80' : '#2563eb', color: isLastUnit ? '#111' : '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            {isLastUnit ? "Finish Workout 🎉" : "Next Exercise ➔"}
          </button>

          <RestTimerPanel
            restTimeLeft={restTimeLeft}
            isRestTimerRunning={isRestTimerRunning}
            onAddTime={addRestTime}
            onTogglePause={togglePauseRestTimer}
            onSkip={skipRest}
          />
        </div>
      ) : (
        <CircuitCard
          unit={activeUnit}
          workoutId={workoutId}
          userUnit={weightLabel}
          onCircuitComplete={handleNextExercise}
          circuitState={circuitStates[activeUnit.id] || {}}
          updateCircuitState={(newState) => updateCircuitState(activeUnit.id, newState)}
        />
      )}

      {/* Workout timeline */}
      <WorkoutTimeline
  units={workoutUnits}
  completedSets={allCompletedSets}
  circuitStates={circuitStates}
  activeIndex={activeUnitIndex}
  onSelect={setActiveUnitIndex}
/>
    </div>
  );
}

const headerBtnStyle = (color) => ({
  backgroundColor: 'transparent', color, border: 'none', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer'
});