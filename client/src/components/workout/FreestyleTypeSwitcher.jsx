export default function FreestyleTypeSwitcher({ currentType, onTypeChange }) {
  const types = [
    { value: 'weight_reps', label: '🏋️‍♂️ Lifting' },
    { value: 'time', label: '⏱️ Time' },
    { value: 'distance_time', label: '🏃‍♂️ Running/Cardio' },
  ];
  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
      {types.map(t => (
        <button
          key={t.value}
          type="button"
          onClick={() => onTypeChange(t.value)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #2d2d2d',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            backgroundColor: currentType === t.value ? '#2563eb' : '#111',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}