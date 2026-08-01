import React, { useState } from 'react';

const API = 'http://localhost:5000/api';

/* ============================================================
   IT MANAGER LOGIN — single-account, no registration
   API: POST /api/auth/login  { email, password }
        → { success, token, user }
   ============================================================ */
export default function LoginScreen({ onLogin }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await r.json().catch(() => null);

      if (!r.ok || !data?.success) {
        setError((data?.error) || 'Invalid email or password.');
        return;
      }

      localStorage.setItem('fleetsync_token', data.token);
      localStorage.setItem('fleetsync_user',  JSON.stringify(data.user));
      onLogin(data.user);

    } catch (err) {
      console.error('LOGIN ERROR', err);
      setError('Cannot reach the API server. Is it running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-glow" />

      <div className="login-card">
        {/* Brand */}
        <div className="login-logo">
          <span>📊</span> FleetSync Pro
        </div>
        <p className="login-subtitle">IT Manager Portal — Copier Fleet Monitoring</p>

        {/* Error */}
        {error && <div className="error-banner">⚠ {error}</div>}

        {/* Login form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              className="form-input"
              type="email"
              autoFocus
              placeholder="admin@fleetsync.pro"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={loading}
          >
            {loading ? 'Signing in…' : '→ Sign In'}
          </button>
        </form>

        <p className="login-footnote">
          Default credentials are set via <code>ADMIN_EMAIL</code> and{' '}
          <code>ADMIN_PASSWORD</code> in your <code>.env</code> file.
        </p>
      </div>
    </div>
  );
}
