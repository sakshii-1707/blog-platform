import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

function Register({ onSuccess }) {
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(username, email, password);
    } catch (err) {}
    finally {
      setLoading(false);
      onSuccess && onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Register</h2>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" required />
      <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" required />
      <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password" required />
      <button type="submit" disabled={loading}>{loading ? '...' : 'Register'}</button>
      <div style={{ marginTop: 10 }}>
        Already have an account? <a href="#login" onClick={e => { e.preventDefault(); window.location.hash = '#login' }}>Login</a>
      </div>
    </form>
  );
}

export default Register;
