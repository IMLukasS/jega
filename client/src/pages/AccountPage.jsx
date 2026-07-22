import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'Athlete', email: '' });
  const [unit, setUnit] = useState('lbs');

  useEffect(() => {
    // 1. Grab the user data we saved during login
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // 2. Grab their preferred unit (default to lbs if none exists)
    const storedUnit = localStorage.getItem('preferredUnit') || 'lbs';
    setUnit(storedUnit);
  }, []);

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    localStorage.setItem('preferredUnit', newUnit);
  };

  const handleLogout = () => {
    // Wipe auth tokens but leave the unit preference for this device
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/auth');
  };

  return (
    <div className="app-container">
      <header style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link to="/" style={{ color: '#a1a1aa', textDecoration: 'none' }}>← Back</Link>
        <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Account</h1>
      </header>

      {/* Profile Info Card */}
      <div style={{ 
        background: '#2d2d34', 
        padding: '20px', 
        borderRadius: '12px', 
        border: '1px solid #3e3e4a',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ 
          width: '60px', 
          height: '60px', 
          borderRadius: '50%', 
          background: '#10b981', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          fontSize: '1.5rem',
          fontWeight: 'bold',
          color: '#fff'
        }}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#fff', fontSize: '1.2rem' }}>{user.name}</h2>
          <p style={{ margin: 0, color: '#a1a1aa', fontSize: '0.9rem' }}>{user.email}</p>
        </div>
      </div>

      {/* Preferences Card */}
      <div style={{ 
        background: '#2d2d34', 
        padding: '20px', 
        borderRadius: '12px', 
        border: '1px solid #3e3e4a',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '1.1rem' }}>Preferences</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ display: 'block', color: '#fff', fontWeight: 'bold' }}>Weight Units</span>
            <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Used for all templates and logging</span>
          </div>
          
          <div style={{ display: 'flex', background: '#1e1e24', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => handleUnitChange('lbs')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: unit === 'lbs' ? '#10b981' : 'transparent',
                color: unit === 'lbs' ? '#fff' : '#a1a1aa',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Lbs
            </button>
            <button
              onClick={() => handleUnitChange('kg')}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: unit === 'kg' ? '#10b981' : 'transparent',
                color: unit === 'kg' ? '#fff' : '#a1a1aa',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Kg
            </button>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <button 
        onClick={handleLogout}
        style={{ 
          width: '100%', 
          padding: '16px', 
          background: 'transparent', 
          color: '#ef4444', 
          border: '1px solid #ef444455', 
          borderRadius: '12px', 
          fontWeight: 'bold',
          fontSize: '1rem',
          cursor: 'pointer' 
        }}
      >
        Log Out
      </button>
    </div>
  );
}