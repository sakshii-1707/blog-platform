import React from 'react';
import { useAuth } from '../AuthContext';

export default function Profile() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <div style={{maxWidth:400,padding:12}}>
      <h2>Profile</h2>
      <div><b>Username:</b> {user.username}</div>
      <div><b>Email:</b> {user.email}</div>
      <div><b>Role:</b> {user.role}</div>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
