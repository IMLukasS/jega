import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function AccountPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState({ name: 'Athlete', email: '' });
  const [unit, setUnit] = useState('lbs');
  const [enableAudio, setEnableAudio] = useState(false);
  const [enableHaptics, setEnableHaptics] = useState(false);

  useEffect(() => {
    // 1. Grab the user data we saved during login
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }

    // 2. Grab their preferred unit (default to lbs if none exists)
    const storedUnit = localStorage.getItem('preferredUnit') || 'lbs';
    setUnit(storedUnit);

    // 3. Grab rest timer preferences (default to false / off if not explicitly 'true')
    const storedAudio = localStorage.getItem('enableAudioChime') === 'true';
    setEnableAudio(storedAudio);

    const storedHaptics = localStorage.getItem('enableHaptics') === 'true';
    setEnableHaptics(storedHaptics);
  }, []);

  const handleUnitChange = (newUnit) => {
    setUnit(newUnit);
    localStorage.setItem('preferredUnit', newUnit);
  };

  const handleAudioToggle = (enabled) => {
    setEnableAudio(enabled);
    localStorage.setItem('enableAudioChime', enabled);
  };

  const handleHapticsToggle = (enabled) => {
    setEnableHaptics(enabled);
    localStorage.setItem('enableHaptics', enabled);
  };

  const handleLogout = () => {
    // Wipe auth tokens but leave user preferences for this device
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
        
        {/* Weight Unit Preference */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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

        {/* Rest Timer Audio Chime Preference */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingT: '16px', borderTop: '1px solid #3e3e4a', marginBottom: '16px', paddingTop: '16px' }}>
          <div>
            <span style={{ display: 'block', color: '#fff', fontWeight: 'bold' }}>Timer Sound</span>
            <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Play chime when rest timer hits 0:00</span>
          </div>
          
          <div style={{ display: 'flex', background: '#1e1e24', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => handleAudioToggle(false)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: !enableAudio ? '#3e3e4a' : 'transparent',
                color: !enableAudio ? '#fff' : '#a1a1aa',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Off
            </button>
            <button
              onClick={() => handleAudioToggle(true)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: enableAudio ? '#10b981' : 'transparent',
                color: enableAudio ? '#fff' : '#a1a1aa',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              On
            </button>
          </div>
        </div>

        {/* Rest Timer Haptic Feedback Preference */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #3e3e4a' }}>
          <div>
            <span style={{ display: 'block', color: '#fff', fontWeight: 'bold' }}>Device Vibration</span>
            <span style={{ color: '#a1a1aa', fontSize: '0.85rem' }}>Vibrate mobile device when rest ends</span>
          </div>
          
          <div style={{ display: 'flex', background: '#1e1e24', borderRadius: '8px', padding: '4px' }}>
            <button
              onClick={() => handleHapticsToggle(false)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: !enableHaptics ? '#3e3e4a' : 'transparent',
                color: !enableHaptics ? '#fff' : '#a1a1aa',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Off
            </button>
            <button
              onClick={() => handleHapticsToggle(true)}
              style={{
                padding: '6px 16px',
                borderRadius: '6px',
                border: 'none',
                background: enableHaptics ? '#10b981' : 'transparent',
                color: enableHaptics ? '#fff' : '#a1a1aa',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              On
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