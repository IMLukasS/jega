export default function WorkoutTimeline({ units, completedSets, circuitStates, activeIndex, onSelect }) {
  return (
    <div style={{ marginTop: 'auto' }}>
      <h3 style={{ fontSize: '0.85rem', color: '#888', textTransform: 'uppercase', marginBottom: '12px' }}>Workout Timeline</h3>
      <div style={{ display: 'flex', overflowX: 'auto', gap: '12px', paddingBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {units.map((unit, index) => {
          const isActive = index === activeIndex;
          // For circuit units, derive name and completion from circuitState
          const isCircuit = unit.type === 'circuit';
          const circuitComplete = circuitStates?.[unit.id]?.phaseState === 'completed';
          const setsDone = isCircuit ? (circuitComplete ? 1 : 0) : (completedSets[index] || []).length;
          const tSets = isCircuit ? 1 : (unit.exercises[0]?.sets?.length || unit.exercises[0]?.target_sets || 3);
          const isCompleted = isCircuit ? circuitComplete : (setsDone >= tSets);

          const displayName = isCircuit ? '🔄 Circuit' : unit.exercises[0]?.name;

          return (
            <div
              key={index}
              onClick={() => onSelect(index)}
              style={{
                flex: '0 0 auto',
                width: '140px',
                padding: '12px',
                borderRadius: '12px',
                cursor: 'pointer',
                backgroundColor: isActive ? '#fff' : (isCompleted ? '#111' : '#1e1e1e'),
                border: `1px solid ${isActive ? '#fff' : (isCompleted ? '#4ade80' : '#2d2d2d')}`,
                opacity: (isCompleted && !isActive) ? 0.7 : 1,
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold', color: isActive ? '#000' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {displayName}
                </span>
              </div>
              {/* For circuits, maybe show number of stations? Optional */}
              {isCircuit && (
                <div style={{ fontSize: '0.7rem', color: isActive ? '#444' : '#888', marginBottom: '4px' }}>
                  {unit.exercises.length} stations
                </div>
              )}
              {!isCircuit && unit.exercises[0]?.tags?.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {unit.exercises[0].tags.map((tag, i) => (
                    <span key={i} style={{ fontSize: '0.6rem', background: isActive ? '#2563eb' : '#2d2d2d', color: '#fff', padding: '2px 5px', borderRadius: '4px', fontWeight: 'bold', textTransform: 'uppercase' }}>{tag}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '0.75rem', color: isActive ? '#444' : '#888', display: 'flex', justifyContent: 'space-between' }}>
                {isCircuit ? (
                  <span>{circuitComplete ? 'Done' : 'In progress'}</span>
                ) : (
                  <span>{setsDone}/{tSets} Sets</span>
                )}
                {isCompleted && <span style={{ color: isActive ? '#10b981' : '#4ade80', fontWeight: 'bold' }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}