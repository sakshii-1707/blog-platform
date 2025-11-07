import React, { useState } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import Feed from './pages/Feed';
import PostView from './pages/PostView';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import NewPost from './pages/NewPost';

function Router() {
  // const { user } = useAuth(); // Remove user checks
  const [route, setRoute] = useState(window.location.hash.slice(1) || 'feed');
  const [selectedPost, setSelectedPost] = useState(null);
  React.useEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || 'feed');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  // Main routing logic -- removed all user auth checks! Always show what the route says.
  if (route === 'login') return <Login onSuccess={()=>setRoute('feed')} />;
  if (route === 'register') return <Register onSuccess={()=>setRoute('feed')} />;
  if (route === 'profile') return <Profile />;
  if (route === 'newpost') return <NewPost onDone={()=>setRoute('feed')} />;
  if (selectedPost) return <PostView post={selectedPost} onBack={()=>setSelectedPost(null)} />;
  // Feed page (list of posts)
  return <Feed onSelect={setSelectedPost} onCreate={()=>setRoute('newpost')} />;
}

export default function App() {
  return (
    <AuthProvider>
      <div style={{maxWidth:800,margin:'auto',padding:24}}>
        <div style={{marginBottom:24,display:'flex',justifyContent:'space-between'}}>
          <h1 style={{margin:0}}>Blog Platform</h1>
          <NavBar />
        </div>
        <Router />
      </div>
    </AuthProvider>
  );
}

function NavBar() {
  const { user } = useAuth();
  return (
    <nav>
      {user && <><a href="#feed">Feed</a> | <a href="#profile">Profile</a> | <a href="#newpost">New Post</a></>}
      {!user && <><a href="#login">Login</a> | <a href="#register">Register</a></>}
    </nav>
  );
}
