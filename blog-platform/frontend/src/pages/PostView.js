import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function PostView({ post: initialPost, onBack }) {
  const { user } = useAuth();
  const [post, setPost] = useState(initialPost);
  const [editing, setEditing] = useState(false);
  const [editFields, setEditFields] = useState({ title: post.title, body: post.body });
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  function fetchComments() {
    setLoadingComments(true);
    api.get('/comments', { params: { postId: post._id, limit: 20 } })
      .then(({ data }) => setComments(data.data))
      .finally(()=>setLoadingComments(false));
  }

  useEffect(() => { fetchComments(); }, [post._id]);

  async function handleEdit() {
    try {
      let { data } = await api.put(`/posts/${post._id}`, editFields);
      setPost(data); setEditing(false); setError('');
    } catch (e) { setError(e.response?.data?.error || 'Failed'); }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this post?')) return;
    try {
      await api.delete(`/posts/${post._id}`);
      onBack();
    } catch (e) { alert(e.response?.data?.error || 'Delete failed'); }
  }

  async function handleComment() {
    if (!commentText) return;
    try {
      let { data } = await api.post('/comments', { body: commentText, postId: post._id });
      setComments(cs => [...cs, data]);
      setCommentText('');
    } catch (e) { setError(e.response?.data?.error || 'Comment failed'); }
  }

  const canEdit = user && (user.role === 'admin' || user.username === post.authorId);

  return (
    <div style={{maxWidth:600}}>
      <button onClick={onBack}>Back</button>
      {editing ? (
        <div>
          <h3>Edit Post</h3>
          <input value={editFields.title} onChange={e=>setEditFields({...editFields,title:e.target.value})} />
          <textarea value={editFields.body} onChange={e=>setEditFields({...editFields,body:e.target.value})} rows={6}/>
          <button onClick={handleEdit}>Save</button>
          <button onClick={()=>setEditing(false)}>Cancel</button>
          {error && <div className="error">{error}</div>}
        </div>
      ) : (
        <div>
          <h2>{post.title}</h2>
          <p>{post.body}</p>
          <div style={{color:'#888',fontSize:13}}>By {post.authorId}, {new Date(post.createdAt).toLocaleString()}</div>
          {canEdit && <>
            <button onClick={()=>setEditing(true)}>Edit</button>
            <button onClick={handleDelete}>Delete</button>
          </>}
        </div>
      )}
      <h3>Comments</h3>
      {loadingComments ? <div>Loading...</div> : comments.map(c => (
        <div key={c._id} style={{borderBottom:'1px solid #eee',padding:4}}>
          <b>{c.authorId}</b>: {c.body}
        </div>
      ))}
      {user && <div>
        <textarea value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Add a comment..." />
        <button onClick={handleComment}>Comment</button>
      </div>}
    </div>
  );
}
