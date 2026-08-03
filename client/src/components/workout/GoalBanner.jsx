import { toDisplayWeight } from '../../utils/unitConverter';

export default function GoalBanner({ plannedSet, trackingType, userUnit }) {
  if (!plannedSet) return null;

  let goalText = '';
  const weightLabel = userUnit === 'kg' ? 'Kg' : 'Lbs';
  switch (trackingType) {
    case 'time':
      goalText = `${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`;
      break;
    case 'bodyweight_reps':
      goalText = `${plannedSet.reps || 0} reps`;
      break;
    case 'time_weight':
      goalText = `${toDisplayWeight(plannedSet.weight || 0, userUnit)} ${weightLabel.toLowerCase()} for ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`;
      break;
    case 'distance_time':
      goalText = `${plannedSet.distance || 0} mi in ${plannedSet.time_minutes || 0}m ${plannedSet.time_seconds || 0}s`;
      break;
    default: // weight_reps
      goalText = `${toDisplayWeight(plannedSet.weight || 0, userUnit)} ${weightLabel.toLowerCase()} × ${plannedSet.reps || 0} reps`;
  }

  return (
    <div style={{ backgroundColor: '#2d2d2d', padding: '12px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center', color: '#4ade80', fontWeight: 'bold', fontSize: '1rem', border: '1px dashed #4ade80' }}>
      🎯 Goal for Next Set: {goalText}
    </div>
  );
}