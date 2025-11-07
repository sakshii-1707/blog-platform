import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';

export default function Feed({ onSelect, onCreate }) {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    setLoading(true);
    api.get('/posts', { params: { page, limit: 10 } })
      .then(({ data }) => {
        setPosts(data.data);
        setTotal(data.total);
      })
      .catch(() => {
        setPosts([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  // add user so refetch triggers after login/register too
  }, [page, user]);

  // Force at least 1 page
  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <h2>Feed</h2>
        {user && <button onClick={onCreate}>New Post</button>}
      </div>
      {loading && <div>Loading...</div>}
      {posts.map(post => (
        <div key={post._id} className="post-snippet" onClick={()=>onSelect(post)} style={{cursor:'pointer',borderBottom:'1px solid #ddd',marginBottom:10}}>
          <h3>{post.title}</h3>
          <div style={{color:'#666', fontSize:13}}>By {post.authorId}, {new Date(post.createdAt).toLocaleString()}</div>
        </div>
      ))}
      <div style={{marginTop:36}}>
        Page {page} of {totalPages}
        <button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Prev</button>
        <button disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
      </div>
    </div>
  );
}
