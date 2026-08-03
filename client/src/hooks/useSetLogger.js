// src/hooks/useSetLogger.js
import { useState, useEffect } from 'react';
import { fetchWithAuth } from '../apiClient';
import { toBaseKg, toDisplayWeight } from '../utils/unitConverter';

export const useSetLogger = ({
  activeExercise,
  activeExerciseIndex,
  workoutId,
  userUnit,
  onSetLogged,
}) => {
  const [allCompletedSets, setAllCompletedSets] = useState({});

  // Auto‑save completedSets to localStorage for resume
  useEffect(() => {
    if (!workoutId) return;
    const savedSession = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    if (savedSession) {
      savedSession.completedSets = allCompletedSets;
      localStorage.setItem('activeWorkoutSession', JSON.stringify(savedSession));
    }
  }, [allCompletedSets, workoutId]);

  const currentCompletedSets = allCompletedSets[activeExerciseIndex] || [];

  // Form state
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [timeMin, setTimeMin] = useState('');
  const [timeSec, setTimeSec] = useState('');
  const [distance, setDistance] = useState('');
  const [rpe, setRpe] = useState('');
  const [editingSetIndex, setEditingSetIndex] = useState(null);

  // Determine planned set from routine
  const currentSetIndex = currentCompletedSets.length;
  const plannedSet = activeExercise?.sets?.[currentSetIndex];

  // Autofill form when exercise/index/plannedSet changes (unless editing)
  useEffect(() => {
    if (editingSetIndex !== null) return;
    if (plannedSet) {
      setWeight(plannedSet.weight != null ? String(toDisplayWeight(plannedSet.weight, userUnit)) : '');
      setReps(plannedSet.reps != null ? String(plannedSet.reps) : '');
      setTimeMin(plannedSet.time_minutes != null ? String(plannedSet.time_minutes) : '');
      setTimeSec(plannedSet.time_seconds != null ? String(plannedSet.time_seconds) : '');
      setDistance(plannedSet.distance != null ? String(plannedSet.distance) : '');
      setRpe('');
    } else {
      setWeight('');
      setReps('');
      setTimeMin('');
      setTimeSec('');
      setDistance('');
      setRpe('');
    }
  }, [activeExerciseIndex, currentSetIndex, plannedSet, editingSetIndex, userUnit]);

  const resetForm = () => {
    setWeight('');
    setReps('');
    setTimeMin('');
    setTimeSec('');
    setDistance('');
    setRpe('');
  };

  const handleLogSet = async (e) => {
    e.preventDefault();
    if (!activeExercise) return;

    const isEditing = editingSetIndex !== null;
    const baseKgValue = weight === '' ? 0 : toBaseKg(weight, userUnit);

    const payload = {
      exercise_id: activeExercise.exercise_id || activeExercise.id,
      set_number: isEditing ? editingSetIndex + 1 : currentCompletedSets.length + 1,
      actual_weight_kg: baseKgValue,
      actual_reps: reps === '' ? 0 : Number(reps),
      time_minutes: timeMin === '' ? 0 : Number(timeMin),
      time_seconds: timeSec === '' ? 0 : Number(timeSec),
      distance: distance === '' ? 0 : Number(distance),
      rpe: rpe === '' ? null : Number(rpe),
    };

    try {
      const endpoint = isEditing
        ? `/api/v1/workouts/${workoutId}/sets/${currentCompletedSets[editingSetIndex].id}`
        : `/api/v1/workouts/${workoutId}/sets`;

      const response = await fetchWithAuth(endpoint, {
        method: isEditing ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const savedSet = await response.json();
        const actualKg = savedSet.actual_weight_kg ?? baseKgValue;

        if (isEditing) {
          setAllCompletedSets(prev => {
            const updated = [...prev[activeExerciseIndex]];
            updated[editingSetIndex] = {
              id: savedSet.id || currentCompletedSets[editingSetIndex].id,
              weight,
              actual_weight_kg: actualKg,
              reps,
              timeMin,
              timeSec,
              distance,
              rpe: rpe || null,
            };
            return { ...prev, [activeExerciseIndex]: updated };
          });
          setEditingSetIndex(null);
        } else {
          const newSet = {
            id: savedSet.id,
            weight,
            actual_weight_kg: actualKg,
            reps,
            timeMin,
            timeSec,
            distance,
            rpe: rpe || null,
          };
          setAllCompletedSets(prev => ({
            ...prev,
            [activeExerciseIndex]: [...(prev[activeExerciseIndex] || []), newSet],
          }));
          resetForm();
          onSetLogged?.();
        }
        setRpe('');
      }
    } catch (error) {
      console.error("Failed to log/update set", error);
    }
  };

  const handleStartEdit = (index) => {
    const setToEdit = currentCompletedSets[index];
    setEditingSetIndex(index);
    setWeight(
      setToEdit.actual_weight_kg !== undefined
        ? String(toDisplayWeight(setToEdit.actual_weight_kg, userUnit))
        : setToEdit.weight || ''
    );
    setReps(setToEdit.reps || '');
    setTimeMin(setToEdit.timeMin || '');
    setTimeSec(setToEdit.timeSec || '');
    setDistance(setToEdit.distance || '');
    setRpe(setToEdit.rpe || '');
  };

  const handleCancelEdit = () => {
    setEditingSetIndex(null);
  };

  const handleDeleteActiveSet = async () => {
    if (editingSetIndex === null) return;
    const isSure = window.confirm("Are you sure you want to delete this set?");
    if (!isSure) return;
    const setToDelete = currentCompletedSets[editingSetIndex];
    try {
      const response = await fetchWithAuth(
        `/api/v1/workouts/${workoutId}/sets/${setToDelete.id}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        setAllCompletedSets(prev => {
          const updated = [...prev[activeExerciseIndex]];
          updated.splice(editingSetIndex, 1);
          return { ...prev, [activeExerciseIndex]: updated };
        });
        setEditingSetIndex(null);
      } else {
        alert("Failed to delete set.");
      }
    } catch (error) {
      console.error("Error deleting set:", error);
    }
  };

  return {
    weight,
    setWeight,
    reps,
    setReps,
    timeMin,
    setTimeMin,
    timeSec,
    setTimeSec,
    distance,
    setDistance,
    rpe,
    setRpe,
    editingSetIndex,
    currentCompletedSets,
    plannedSet,
    handleLogSet,
    handleStartEdit,
    handleCancelEdit,
    handleDeleteActiveSet,
    allCompletedSets,
  };
};