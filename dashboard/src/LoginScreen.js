import React, { useState } from 'react';

const API =
  process.env.REACT_APP_API_URL ||
  'http://localhost:5000/api';

export default function LoginScreen({ onLogin }) {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {

    e.preventDefault();

    setLoading(true);
    setError('');

    try {

      const res = await fetch(
        `${API}/auth/login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email,
            password
          })
        }
      );

      const data = await res.json();

      if (!res.ok) {

        setError(
          data.error || 'Login failed'
        );

        setLoading(false);
        return;

      }

      localStorage.setItem(
        'fleetsync_token',
        data.token
      );

      localStorage.setItem(
        'fleetsync_user',
        JSON.stringify(data.user)
      );

      onLogin(data.user);

    } catch {

      setError(
        'Unable to connect to server'
      );

    }

    setLoading(false);

  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#0f172a'
      }}
    >

      <form
        onSubmit={handleLogin}
        style={{
          width: 400,
          padding: 30,
          background: '#1e293b',
          borderRadius: 12
        }}
      >

        <h1
          style={{
            color: '#fff',
            textAlign: 'center'
          }}
        >
          FleetSync Login
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          style={{
            width: '100%',
            padding: 12,
            marginTop: 20
          }}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          style={{
            width: '100%',
            padding: 12,
            marginTop: 10
          }}
        />

        {error && (
          <p
            style={{
              color: 'red'
            }}
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          style={{
            width: '100%',
            marginTop: 20,
            padding: 12
          }}
        >
          {loading
            ? 'Signing In...'
            : 'Login'}
        </button>

      </form>

    </div>
  );

}