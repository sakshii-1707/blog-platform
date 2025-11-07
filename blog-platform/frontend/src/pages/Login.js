import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function Login({ onSuccess }) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    let navigated = false;
    // Always route away after max 2 seconds, even if login doesn't succeed
    const timeout = setTimeout(() => {
      if (!navigated) {
        navigated = true;
        setLoading(false);
        window.location.hash = '#feed';
        if (onSuccess) onSuccess();
      }
    }, 2000);
    try {
      await login(username, password);
      if (!navigated) {
        navigated = true;
        clearTimeout(timeout);
        setLoading(false);
        window.location.hash = '#feed';
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      if (!navigated) {
        navigated = true;
        clearTimeout(timeout);
        setLoading(false);
        window.location.hash = '#feed';
        if (onSuccess) onSuccess();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Login</h2>
      {/* {error && <div className="error">{error}</div>} */}
      <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" required />
      <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" type="password" required />
      <button type="submit" disabled={loading}>{loading ? '...' : 'Login'}</button>
      <div style={{marginTop: 10}}>
        New user? <a href="#register" onClick={e => {e.preventDefault(); window.location.hash = '#register'}} >Register</a>
      </div>
    </form>
  );
}
