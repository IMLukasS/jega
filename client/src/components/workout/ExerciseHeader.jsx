export default function ExerciseHeader({ name, tags, targetSetsCount }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
      <h1 style={{ fontSize: '1.8rem', margin: '0 0 8px 0', color: '#fff' }}>{name}</h1>
      {tags?.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {tags.map((tag, i) => (
            <span key={i} style={{ background: '#2563eb', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{tag}</span>
          ))}
        </div>
      )}
      <span style={{ color: '#888', fontSize: '0.9rem', backgroundColor: '#111', padding: '6px 12px', borderRadius: '12px' }}>
        Target: {targetSetsCount} Sets
      </span>
    </div>
  );
}