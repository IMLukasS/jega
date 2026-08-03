import { renderCompletedSetText } from '../../utils/setDisplay';

export default function CompletedSetsList({ sets, trackingType, userUnit, onEdit }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
      {sets.map((set, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', border: '1px solid #2d2d2d', padding: '12px 16px', borderRadius: '8px' }}>
          <span style={{ color: '#888' }}>Set {i + 1}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ color: '#fff', fontWeight: 'bold' }}>
              {renderCompletedSetText(set, trackingType, userUnit)}
            </span>
            {set.rpe && (
              <span style={{ color: '#eab308', background: '#322203', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                RPE {set.rpe}
              </span>
            )}
            <button type="button" onClick={() => onEdit(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.95rem', padding: 0 }}>✏️</button>
            <span style={{ color: '#4ade80' }}>✓</span>
          </div>
        </div>
      ))}
    </div>
  );
}