import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function TemplatesPage() {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3000/api/v1/routines')
      .then((res) => res.json())
      .then((data) => {
        setRoutines(data);
        setLoading(false);
      })
      .catch((err) => console.error('Error fetching routines:', err));
  }, []);

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm("Are you sure you want to permanently delete this blueprint template?")) return;

    try {
      const response = await fetch(`http://localhost:3000/api/v1/routines/${templateId}`, { method: 'DELETE' });
      if (response.ok) {
        setRoutines(prev => prev.filter(r => r.id !== templateId));
      }
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  if (loading) return <p style={{ color: '#888', padding: '20px' }}>Loading Blueprints...</p>;

  return (
    <div className="app-container">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <Link to="/" style={{ color: '#a1a1aa', textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Workouts</h1>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ color: '#a1a1aa', fontSize: '0.9rem' }}>Select a template to initiate a session</span>
        <Link to="/create-template" style={{ backgroundColor: '#007bff', color: '#fff', padding: '6px 14px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}>
          ＋ Create Template
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {routines.map((routine) => (
          <div key={routine.id} className="workout-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#2d2d34', borderRadius: '8px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: '#fff' }}>{routine.name}</h3>
              <span style={{ fontSize: '0.85rem', color: '#a1a1aa' }}>{routine.exercises?.length || 0} Exercises mapped</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
  
            {/* ✏️ NEW: Edit Template Button */}
            <Link 
                to={`/edit-template/${routine.id}`} 
                state={{ templateToEdit: routine }} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', textDecoration: 'none' }}
            >
                ✏️
            </Link>

            <button 
                onClick={() => handleDeleteTemplate(routine.id)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
            >
                🗑️
            </button>
            
            <Link 
                to={`/focus/${routine.id}`} 
                style={{ backgroundColor: '#10b981', color: '#fff', padding: '8px 16px', borderRadius: '6px', textDecoration: 'none', fontWeight: 'bold' }}
            >
                Start
            </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}