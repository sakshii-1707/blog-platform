import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function NewPost({ onDone }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    if (!token || token === 'FAKE_TOKEN') {
      setError('You must be logged in to create a new post.');
      setLoading(false);
      return;
    }
    try {
      await api.post('/posts', { title, body, tags: tags.split(',').map(x=>x.trim()).filter(Boolean) }, { headers: { Authorization: 'Bearer ' + token } });
      onDone();
    } catch (e) {
      if (e.response?.data?.error) setError(e.response.data.error);
      else setError('Cannot reach the posts service. Please check your connection or try again.');
    } finally {
      setLoading(false);
    }
  }
  return (
    <form onSubmit={submit} className="newpost-form">
      <h2>New Post</h2>
      <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title" required />
      <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Body..." rows={6} required />
      <input value={tags} onChange={e=>setTags(e.target.value)} placeholder="Tags (comma separated)" />
      <button type="submit" disabled={loading}>{loading ? '...' : 'Post'}</button>
      <button type="button" onClick={onDone}>Cancel</button>
      {error && <div className="error">{error}</div>}
    </form>
  );
}
