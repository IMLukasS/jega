export default function SetInputForm({
  trackingType,
  weight, setWeight,
  reps, setReps,
  timeMin, setTimeMin,
  timeSec, setTimeSec,
  distance, setDistance,
  rpe, setRpe,
  editingSetIndex,
  onSubmit,
  onCancelEdit,
  onDeleteSet,
  userUnit,
}) {
  const weightLabel = userUnit === 'kg' ? 'Kg' : 'Lbs';

  const renderInputs = () => {
    switch (trackingType) {
      case 'time':
        return (
          <>
            <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={inputStyle} />
          </>
        );
      case 'bodyweight_reps':
        return <input type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle} />;
      case 'time_weight':
        return (
          <>
            <input type="number" placeholder={weightLabel} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={inputStyle} />
          </>
        );
      case 'distance_time':
        return (
          <>
            <input type="number" placeholder="Miles" step="0.1" value={distance} onChange={(e) => setDistance(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Min" value={timeMin} onChange={(e) => setTimeMin(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Sec" value={timeSec} onChange={(e) => setTimeSec(e.target.value)} style={inputStyle} />
          </>
        );
      default: // weight_reps
        return (
          <>
            <input type="number" placeholder={weightLabel} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} style={inputStyle} />
            <input type="number" placeholder="Reps" value={reps} onChange={(e) => setReps(e.target.value)} style={inputStyle} />
          </>
        );
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', gap: '12px' }}>
        {renderInputs()}
        <input
          type="number" placeholder="RPE" step="0.5" min="1" max="10" value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          style={{ width: '75px', backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#eab308', fontSize: '1.1rem', textAlign: 'center', outline: 'none', fontWeight: 'bold' }}
        />
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {editingSetIndex !== null && (
          <>
            <button type="button" onClick={onCancelEdit} style={{ backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 1 }}>Cancel</button>
            <button type="button" onClick={onDeleteSet} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 1 }}>Delete</button>
          </>
        )}
        <button type="submit" style={{ backgroundColor: editingSetIndex !== null ? '#eab308' : '#111', color: editingSetIndex !== null ? '#111' : '#fff', border: 'none', borderRadius: '8px', padding: '16px', fontWeight: 'bold', fontSize: '1.1rem', flex: 2 }}>
          {editingSetIndex !== null ? `Update Set ${editingSetIndex + 1}` : 'Log Set'}
        </button>
      </div>
    </form>
  );
}

const inputStyle = {
  flex: 2, minWidth: 0, backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', color: '#fff', fontSize: '1.1rem', textAlign: 'center', outline: 'none'
};