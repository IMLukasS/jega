import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_URL from '../api';

export default function AuthPage() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register';

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed. Please try again.');
      }

      // 🔑 Save token & user profile to localStorage
      localStorage.setItem('token', data.token);
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
      }

      // 🚀 Redirect straight to the Dashboard
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '400px', margin: '40px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '4px' }}>Jega</h1>
        <p style={{ color: '#a1a1aa', fontSize: '0.9rem', margin: 0 }}>
          {isLogin ? 'Sign in to access your workouts' : 'Create an account to get started'}
        </p>
      </div>

      <div style={{ 
        background: '#2d2d34', 
        padding: '24px', 
        borderRadius: '12px', 
        border: '1px solid #3e3e4a' 
      }}>
        {/* Toggle Tabs */}
        <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #3e3e4a' }}>
          <button
            onClick={() => { setIsLogin(true); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              background: 'none',
              border: 'none',
              color: isLogin ? '#10b981' : '#a1a1aa',
              borderBottom: isLogin ? '2px solid #10b981' : 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Login
          </button>
          <button
            onClick={() => { setIsLogin(false); setError(''); }}
            style={{
              flex: 1,
              padding: '10px',
              background: 'none',
              border: 'none',
              color: !isLogin ? '#10b981' : '#a1a1aa',
              borderBottom: !isLogin ? '2px solid #10b981' : 'none',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div style={{ 
            background: '#ef444422', 
            color: '#f87171', 
            padding: '10px', 
            borderRadius: '6px', 
            marginBottom: '16px',
            fontSize: '0.85rem',
            border: '1px solid #ef444444'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!isLogin && (
            <div>
              <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.8rem', marginBottom: '4px' }}>Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required={!isLogin}
                placeholder="Alex Smith"
                style={{
                  width: '100%',
                  padding: '10px',
                  borderRadius: '6px',
                  background: '#1e1e24',
                  border: '1px solid #3e3e4a',
                  color: '#fff',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.8rem', marginBottom: '4px' }}>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="alex@example.com"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                background: '#1e1e24',
                border: '1px solid #3e3e4a',
                color: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', color: '#a1a1aa', fontSize: '0.8rem', marginBottom: '4px' }}>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                background: '#1e1e24',
                border: '1px solid #3e3e4a',
                color: '#fff',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '10px',
              padding: '12px',
              borderRadius: '6px',
              border: 'none',
              background: '#10b981',
              color: '#fff',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}