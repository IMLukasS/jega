// src/utils/setDisplay.js
import { toDisplayWeight } from './unitConverter';

  export const formatTime = (totalSeconds) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');

    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(mins)}:${pad(secs)}`;
  };

  export const formatRestDisplay = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  export const renderCompletedSetText = (set, type, userUnit) => {
  const displayWeight = set.actual_weight_kg !== undefined
    ? toDisplayWeight(set.actual_weight_kg, userUnit)
    : (set.weight || 0);

  if (type === 'time') return `${set.timeMin || 0}m ${set.timeSec || 0}s`;
  if (type === 'bodyweight_reps') return `${set.reps || 0} reps`;
  if (type === 'time_weight') return `${displayWeight} ${userUnit} × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
  if (type === 'distance_time') return `${set.distance || 0} mi × ${set.timeMin || 0}m ${set.timeSec || 0}s`;
  return `${displayWeight} ${userUnit} × ${set.reps || 0} reps`;
};