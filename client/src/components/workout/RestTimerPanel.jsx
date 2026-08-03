import { formatRestDisplay } from '../../utils/setDisplay';

export default function RestTimerPanel({
  restTimeLeft,
  isRestTimerRunning,
  onAddTime,
  onTogglePause,
  onSkip,
}) {
  return (
    <div style={{ backgroundColor: '#111', border: '1px solid #2d2d2d', borderRadius: '8px', padding: '16px', marginTop: '16px', textAlign: 'center' }}>
      <div style={{ marginBottom: '12px' }}>
        <span style={{
          fontSize: '2.4rem', fontFamily: 'monospace', fontWeight: 'bold',
          color: restTimeLeft > 0 ? '#10b981' : '#555'
        }}>
          {formatRestDisplay(restTimeLeft)}
        </span>
        {restTimeLeft > 0 && (
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {isRestTimerRunning ? '⏱️ Rest Active' : '⏸️ Paused'}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {[15, 30, 60].map(sec => (
          <button key={sec} type="button" onClick={() => onAddTime(sec)} style={{ backgroundColor: '#2d2d2d', color: '#10b981', border: '1px solid #10b981', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
            +{sec}s{sec === 60 ? ' (1m)' : ''}
          </button>
        ))}
        {restTimeLeft > 0 && (
          <>
            <button type="button" onClick={onTogglePause} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              {isRestTimerRunning ? 'Pause' : 'Resume'}
            </button>
            <button type="button" onClick={onSkip} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem' }}>
              Skip ✕
            </button>
          </>
        )}
      </div>
    </div>
  );
}