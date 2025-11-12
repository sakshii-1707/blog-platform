import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_BASE = (import.meta.env.VITE_API_BASE) || __API_BASE__;

// Format date as DD/MM/YYYY
function formatDate(dateString) {
	if (!dateString) return '';
	const date = new Date(dateString);
	const day = String(date.getDate()).padStart(2, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const year = date.getFullYear();
	return `${day}/${month}/${year}`;
}

function useAuth() {
	const [token, setToken] = useState(localStorage.getItem('token'));
	const [user, setUser] = useState(() => {
		const u = localStorage.getItem('user');
		return u ? JSON.parse(u) : null;
	});
	function saveAuth(t, u) {
		setToken(t); setUser(u);
		localStorage.setItem('token', t);
		localStorage.setItem('user', JSON.stringify(u));
	}
	function updateUser(updatedUser) {
		setUser(updatedUser);
		localStorage.setItem('user', JSON.stringify(updatedUser));
	}
	function logout() {
		setToken(null); setUser(null);
		localStorage.removeItem('token');
		localStorage.removeItem('user');
	}
	return { token, user, saveAuth, updateUser, logout };
}

function LoginRegister({ onAuthed }) {
	const [mode, setMode] = useState('login');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [name, setName] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
	async function submit(e) {
		e.preventDefault();
		try {
			setError('');
			setLoading(true);
			const controller = new AbortController();
			// Allow up to 45s to match gateway proxyTimeout
			const t = setTimeout(() => controller.abort(), 45000);
			const body = mode === 'login' ? { email, password } : { email, password, name };
			const payload = { email: email.trim(), password, ...(mode === 'login' ? {} : { name: name.trim() }) };
			const res = await fetch(`${API_BASE}${endpoint}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				signal: controller.signal
			});
			clearTimeout(t);
			const text = await res.text();
			let data = {};
			try { data = text ? JSON.parse(text) : {}; } catch { /* ignore parse */ }
			if (!res.ok) {
				let msg = `Request failed (${res.status})`;
				if (typeof data?.error === 'string') {
					msg = data.error;
				} else if (data?.error?.fieldErrors) {
					const fieldErrors = Object.entries(data.error.fieldErrors)
						.filter(([, arr]) => Array.isArray(arr) && arr.length)
						.map(([field, arr]) => `${field}: ${arr.join(', ')}`);
					if (fieldErrors.length) {
						msg = fieldErrors.join('\n');
					}
				} else if (data?.error?.formErrors?.length) {
					msg = data.error.formErrors.join(', ');
				}
				setError(msg);
				return;
			}
			onAuthed(data.token, data.user);
		} catch (err) {
			console.error(err);
			if (err?.name === 'AbortError') {
				setError('Request timed out. Is the gateway reachable at http://localhost:8080?');
			} else {
				setError('Network error. Check gateway at http://localhost:8080/health');
			}
		} finally {
			setLoading(false);
		}
	}
	return (
		<div className="card card-auth">
			<h2 className="title">{mode === 'login' ? 'Login' : 'Create account'}</h2>
			<form onSubmit={submit} className="form">
				{mode === 'register' && (
					<input className="input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
				)}
				<input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
				<input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
				<button className="btn btn-primary" type="submit" disabled={loading}>
					{loading ? 'Please wait…' : (mode === 'login' ? 'Login' : 'Create account')}
				</button>
			</form>
			{error && <div className="error">{String(error)}</div>}
			<div style={{ 
				marginTop: '20px', 
				paddingTop: '20px', 
				borderTop: '1px solid var(--border)',
				textAlign: 'center'
			}}>
				<button 
					className="auth-switch-btn" 
					onClick={() => {
						setMode(mode === 'login' ? 'register' : 'login');
						setError('');
						setEmail('');
						setPassword('');
						setName('');
					}}
				>
					{mode === 'login' ? (
						<>
							<span>Don't have an account?</span>
							<span className="auth-switch-link">Create account</span>
						</>
					) : (
						<>
							<span>Already have an account?</span>
							<span className="auth-switch-link">Login</span>
						</>
					)}
				</button>
			</div>
		</div>
	);
}

function ProfileView({ user, token, headers, onUserUpdate, userPosts, setView }) {
	const [editName, setEditName] = useState(user.name);
	const [showEditProfile, setShowEditProfile] = useState(false);
	const [showResetPassword, setShowResetPassword] = useState(false);
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');
	const [loading, setLoading] = useState(false);
	
	useEffect(() => {
		setEditName(user.name);
	}, [user.name]);

	async function handleUpdateProfile(e) {
		e.preventDefault();
		if (!editName.trim()) {
			setError('Name cannot be empty');
			return;
		}
		setLoading(true);
		setError('');
		setSuccess('');
		try {
			const res = await fetch(`${API_BASE}/users/profile/me`, {
				method: 'PUT',
				headers,
				body: JSON.stringify({ name: editName.trim() })
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to update profile');
			}
			const data = await res.json();
			setSuccess('Profile updated successfully!');
			setShowEditProfile(false);
			if (onUserUpdate) {
				onUserUpdate({ ...user, name: data.name });
			}
			setTimeout(() => setSuccess(''), 3000);
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}

	async function handleResetPassword(e) {
		e.preventDefault();
		if (newPassword !== confirmPassword) {
			setError('New passwords do not match');
			return;
		}
		if (newPassword.length < 8) {
			setError('Password must be at least 8 characters');
			return;
		}
		setLoading(true);
		setError('');
		setSuccess('');
		try {
			const res = await fetch(`${API_BASE}/users/profile/password`, {
				method: 'PUT',
				headers,
				body: JSON.stringify({ currentPassword, newPassword })
			});
			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to change password');
			}
			setSuccess('Password changed successfully!');
			setCurrentPassword('');
			setNewPassword('');
			setConfirmPassword('');
			setShowResetPassword(false);
			setTimeout(() => setSuccess(''), 3000);
		} catch (e) {
			setError(e.message);
		} finally {
			setLoading(false);
		}
	}

	return (
		<div>
			{/* Profile Information Card */}
			<div className="card" style={{ marginBottom: '20px' }}>
				<div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
					<div style={{ 
						width: '100px', 
						height: '100px', 
						borderRadius: '50%', 
						background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						fontSize: '40px',
						color: 'white',
						fontWeight: 'bold',
						flexShrink: 0
					}}>
						{user.name.charAt(0).toUpperCase()}
					</div>
					<div style={{ flex: 1 }}>
						<h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>{user.name}</h2>
						<p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '16px' }}>{user.email}</p>
						<p style={{ margin: '0', color: '#888', fontSize: '14px' }}>
							Role: <span style={{ textTransform: 'capitalize', fontWeight: '500' }}>{user.role || 'user'}</span>
						</p>
					</div>
				</div>
				
				{/* Action Buttons */}
				<div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
					<button 
						className="btn btn-primary" 
						onClick={() => { setShowEditProfile(!showEditProfile); setShowResetPassword(false); setError(''); setSuccess(''); }}
						style={{ flex: '1', minWidth: '150px' }}
					>
						✏️ Edit Profile
					</button>
					<button 
						className="btn" 
						onClick={() => { setShowResetPassword(!showResetPassword); setShowEditProfile(false); setError(''); setSuccess(''); }}
						style={{ flex: '1', minWidth: '150px' }}
					>
						🔒 Reset Password
					</button>
				</div>
				
				{/* Messages */}
				{error && <div className="error" style={{ marginTop: '20px' }}>{error}</div>}
				{success && <div style={{ color: '#28a745', padding: '12px', background: '#d4edda', borderRadius: '6px', marginTop: '20px' }}>{success}</div>}
					
			</div>
			
			{/* Edit Profile Form */}
			{showEditProfile && (
				<div className="card" style={{ marginBottom: '20px' }}>
					<form onSubmit={handleUpdateProfile} className="form">
						<h3 style={{ 
							marginTop: '0', 
							marginBottom: '20px', 
							color: '#333',
							fontSize: '20px',
							fontWeight: '600'
						}}>Edit Profile</h3>
						<label style={{ 
							display: 'block', 
							marginBottom: '8px', 
							color: '#666',
							fontSize: '14px',
							fontWeight: '500'
						}}>Name</label>
						<input 
							className="input" 
							value={editName} 
							onChange={e => setEditName(e.target.value)}
							placeholder="Enter your name"
							style={{
								width: '100%',
								padding: '12px',
								border: '1px solid #ddd',
								borderRadius: '8px',
								fontSize: '16px',
								marginBottom: '20px',
								background: '#f8f9fa'
							}}
						/>
						<div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
							<button 
								className="btn btn-primary" 
								type="submit" 
								disabled={loading}
								style={{
									padding: '10px 24px',
									borderRadius: '8px',
									border: 'none',
									cursor: loading ? 'not-allowed' : 'pointer'
								}}
							>
								{loading ? 'Updating...' : 'Save Changes'}
							</button>
							<button 
								className="btn" 
								type="button"
								onClick={() => { setShowEditProfile(false); setEditName(user.name); setError(''); }}
								style={{
									padding: '10px 24px',
									borderRadius: '8px',
									background: '#6c757d',
									color: 'white',
									border: 'none',
									cursor: 'pointer'
								}}
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}
			
			{/* Reset Password Form */}
			{showResetPassword && (
				<div className="card" style={{ marginBottom: '20px' }}>
					<form onSubmit={handleResetPassword} className="form">
						<h3 style={{ 
							marginTop: '0', 
							marginBottom: '20px', 
							color: '#333',
							fontSize: '20px',
							fontWeight: '600'
						}}>Reset Password</h3>
						<label style={{ 
							display: 'block', 
							marginBottom: '8px', 
							color: '#666',
							fontSize: '14px',
							fontWeight: '500'
						}}>Current Password</label>
						<input 
							className="input" 
							type="password"
							value={currentPassword} 
							onChange={e => setCurrentPassword(e.target.value)}
							placeholder="Enter current password"
							style={{
								width: '100%',
								padding: '12px',
								border: '1px solid #ddd',
								borderRadius: '8px',
								fontSize: '16px',
								marginBottom: '20px',
								background: '#f8f9fa'
							}}
						/>
						<label style={{ 
							display: 'block', 
							marginBottom: '8px', 
							marginTop: '10px', 
							color: '#666',
							fontSize: '14px',
							fontWeight: '500'
						}}>New Password</label>
						<input 
							className="input" 
							type="password"
							value={newPassword} 
							onChange={e => setNewPassword(e.target.value)}
							placeholder="Enter new password (min 8 characters)"
							style={{
								width: '100%',
								padding: '12px',
								border: '1px solid #ddd',
								borderRadius: '8px',
								fontSize: '16px',
								marginBottom: '20px',
								background: '#f8f9fa'
							}}
						/>
						<label style={{ 
							display: 'block', 
							marginBottom: '8px', 
							marginTop: '10px', 
							color: '#666',
							fontSize: '14px',
							fontWeight: '500'
						}}>Confirm New Password</label>
						<input 
							className="input" 
							type="password"
							value={confirmPassword} 
							onChange={e => setConfirmPassword(e.target.value)}
							placeholder="Confirm new password"
							style={{
								width: '100%',
								padding: '12px',
								border: '1px solid #ddd',
								borderRadius: '8px',
								fontSize: '16px',
								marginBottom: '20px',
								background: '#f8f9fa'
							}}
						/>
						<div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
							<button 
								className="btn btn-primary" 
								type="submit" 
								disabled={loading}
								style={{
									padding: '10px 24px',
									borderRadius: '8px',
									border: 'none',
									cursor: loading ? 'not-allowed' : 'pointer'
								}}
							>
								{loading ? 'Changing...' : 'Change Password'}
							</button>
							<button 
								className="btn" 
								type="button"
								onClick={() => { 
									setShowResetPassword(false); 
									setCurrentPassword(''); 
									setNewPassword(''); 
									setConfirmPassword(''); 
									setError(''); 
								}}
								style={{
									padding: '10px 24px',
									borderRadius: '8px',
									background: '#6c757d',
									color: 'white',
									border: 'none',
									cursor: 'pointer'
								}}
							>
								Cancel
							</button>
						</div>
					</form>
				</div>
			)}
			
			{/* Statistics Card */}
			<div className="card">
				<h3 style={{ marginTop: '0', marginBottom: '24px', fontSize: '20px', fontWeight: '600' }}>📊 Statistics</h3>
				<div style={{ 
					display: 'flex', 
					alignItems: 'center', 
					justifyContent: 'center',
					padding: '30px',
					background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
					borderRadius: '12px',
					color: 'white',
					marginBottom: '24px'
				}}>
					<div style={{ textAlign: 'center' }}>
						<div style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '8px', lineHeight: '1' }}>
							{userPosts.length}
						</div>
						<div style={{ fontSize: '16px', opacity: 0.95, fontWeight: '500' }}>Total Posts</div>
					</div>
				</div>
				<div style={{ textAlign: 'center' }}>
					<button 
						className="btn btn-primary" 
						onClick={() => setView('my-posts')}
						style={{
							padding: '14px 40px',
							fontSize: '16px',
							fontWeight: '600',
							borderRadius: '8px'
						}}
					>
						📄 View My Posts
					</button>
				</div>
			</div>
		</div>
	);
}

function Feed({ token, user, onLogout, onUserUpdate }) {
	const [view, setView] = useState(null); // null = home, 'create-post', 'my-posts', or 'feed'
	const [posts, setPosts] = useState([]);
	const [loading, setLoading] = useState(true);
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [error, setError] = useState('');
	const [userCache, setUserCache] = useState({});

	const headers = useMemo(() => ({
		'Content-Type': 'application/json',
		Authorization: token ? `Bearer ${token}` : undefined
	}), [token]);

	async function loadUser(userId) {
		if (userCache[userId]) return userCache[userId];
		try {
			const res = await fetch(`${API_BASE}/users/public/${userId}`, { headers });
			if (res.ok) {
				const data = await res.json();
				setUserCache(c => ({ ...c, [userId]: data }));
				return data;
			}
		} catch (e) {
			console.error(e);
		}
		return { name: 'Unknown User', email: '' };
	}

	async function load(retries = 2) {
		try {
			setError('');
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			const res = await fetch(`${API_BASE}/posts`, { 
				headers,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			
			// Handle 304 Not Modified (cached response)
			if (res.status === 304) {
				return; // Don't update, data is cached
			}
			
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			
			const data = await res.json();
			if (!Array.isArray(data)) {
				throw new Error('Invalid response format');
			}
			
			setPosts(data);
			// Load user info for all posts
			const userIds = [...new Set(data.map(p => p.userId))];
			userIds.forEach(uid => loadUser(uid));
			setLoading(false);
		} catch (e) {
			console.error('Failed to load posts:', e);
			// Retry on failure
			if (retries > 0 && e.name !== 'AbortError') {
				console.log(`Retrying... ${retries} attempts left`);
				setTimeout(() => load(retries - 1), 1000);
			} else {
				setError('Failed to load posts. Please refresh the page.');
				setLoading(false);
				// Auto-clear error after 5 seconds
				setTimeout(() => setError(''), 5000);
			}
		}
	}
	
	useEffect(() => { 
		// Load posts if we're viewing feed, my-posts, or profile
		if (view === 'feed' || view === 'my-posts' || view === 'profile') {
			load(); 
			// Auto-refresh every 5 seconds to see new posts from other users
			const interval = setInterval(load, 5000);
			return () => clearInterval(interval);
		}
	}, [view]); // Load when view changes
	
	// Filter posts based on current view
	const displayedPosts = view === 'my-posts' 
		? posts.filter(p => p.userId === user.id)
		: posts;

	async function createPost(e) {
		e.preventDefault();
		const optimistic = { id: `tmp-${Date.now()}`, title, content, userId: user.id, createdAt: new Date().toISOString() };
		setPosts(p => [optimistic, ...p]);
		const postTitle = title;
		const postContent = content;
		setTitle(''); setContent('');
		try {
			const res = await fetch(`${API_BASE}/posts`, { method: 'POST', headers, body: JSON.stringify({ title: postTitle, content: postContent }) });
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			const data = await res.json();
			setPosts(p => p.map(x => x.id === optimistic.id ? data : x));
			setError('');
			// Redirect to my-posts after successful creation
			setView('my-posts');
		} catch (e) {
			console.error(e);
			setPosts(p => p.filter(x => x.id !== optimistic.id));
			setError('Failed to create post');
		}
	}

	// Show landing page with hero section
	if (view === null) {
		return (
			<div style={{ 
				minHeight: '100vh',
				overflow: 'auto'
			}}>
				<nav className="nav">
					<div className="brand" onClick={() => setView(null)} style={{ cursor: 'pointer' }}>Blog Platform</div>
					<div className="nav-right">
						<button className={`nav-link ${view === 'feed' ? 'active' : ''}`} onClick={() => setView('feed')}>Feed</button>
						<button className={`nav-link ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>Profile</button>
						<button className={`nav-link ${view === 'create-post' ? 'active' : ''}`} onClick={() => setView('create-post')}>New Post</button>
						<span className="user-greeting">Hi, {user.name}</span>
						<button className="nav-logout" onClick={onLogout}>Logout</button>
					</div>
				</nav>
				<div className="landing-hero">
					<h1>Write. Share. Discover.</h1>
					<p>
						Share your thoughts, connect with others, and explore a world of ideas. Your voice matters here.
					</p>
					<div className="landing-actions">
						<button
							className="btn btn-primary"
							onClick={() => setView('feed')}
						>
							📰 Go to Feed
						</button>
						<button
							className="btn"
							onClick={() => setView('create-post')}
							style={{ 
								background: 'transparent',
								border: '2px solid var(--primary)',
								color: 'var(--primary)'
							}}
						>
							✍️ Write a Post
						</button>
					</div>
				</div>
			</div>
		);
	}

	// Calculate user posts
	const userPosts = posts.filter(p => p.userId === user.id);

	return (
		<div className="container">
			<nav className="nav">
				<div className="brand" onClick={() => setView(null)} style={{ cursor: 'pointer' }}>Blog Platform</div>
				<div className="nav-right">
					<button className={`nav-link ${view === null ? 'active' : ''}`} onClick={() => setView(null)}>Home</button>
					<button className={`nav-link ${view === 'feed' ? 'active' : ''}`} onClick={() => setView('feed')}>Feed</button>
					<button className={`nav-link ${view === 'profile' ? 'active' : ''}`} onClick={() => setView('profile')}>Profile</button>
					<button className={`nav-link ${view === 'create-post' ? 'active' : ''}`} onClick={() => setView('create-post')}>New Post</button>
					<span className="user-greeting">Hi, {user.name}</span>
					<button className="nav-logout" onClick={onLogout}>Logout</button>
				</div>
			</nav>
			
			{/* Create Post View */}
			{view === 'create-post' && (
				<div>
					<div className="card">
						<h2 style={{ marginTop: '0', marginBottom: '20px' }}>✍️ Create New Post</h2>
						<form onSubmit={createPost} className="form">
							<input className="input" placeholder="Post title" value={title} onChange={e => setTitle(e.target.value)} />
							<textarea className="textarea" placeholder="Write something..." value={content} onChange={e => setContent(e.target.value)} />
							<div className="row-end">
								<button className="btn btn-primary" type="submit" disabled={loading}>📝 Publish</button>
							</div>
						</form>
						{error && <div className="error">{error}</div>}
					</div>
				</div>
			)}
			
			{/* Feed View */}
			{view === 'feed' && (
				<div>
					<h2 style={{ marginBottom: '20px' }}>📰 Feed - All Posts</h2>
					{loading ? (
						<div className="loading">Loading…</div>
					) : displayedPosts.length === 0 ? (
						<div className="card" style={{ textAlign: 'center', padding: '40px' }}>
							<div className="muted" style={{ fontSize: '18px' }}>
								No posts yet. Be the first to share something! 🚀
							</div>
						</div>
					) : (
						displayedPosts.map(p => <PostCard key={p.id} post={p} token={token} userCache={userCache} currentUser={user} onPostDelete={load} />)
					)}
				</div>
			)}
			
			{/* My Posts View */}
			{view === 'my-posts' && (
				<div>
					<h2 style={{ marginBottom: '20px' }}>📄 My Posts</h2>
					{loading ? (
						<div className="loading">Loading…</div>
					) : displayedPosts.length === 0 ? (
						<div className="card" style={{ textAlign: 'center', padding: '40px' }}>
							<div className="muted" style={{ fontSize: '18px' }}>
								You haven't created any posts yet. Click "Post Blogs" to create your first post! 📝
							</div>
						</div>
					) : (
						displayedPosts.map(p => <PostCard key={p.id} post={p} token={token} userCache={userCache} currentUser={user} onPostDelete={load} />)
					)}
				</div>
			)}
			
			{/* Profile View */}
			{view === 'profile' && (
				<ProfileView 
					user={user} 
					token={token} 
					headers={headers} 
					onUserUpdate={onUserUpdate}
					userPosts={userPosts}
					setView={setView}
				/>
			)}
		</div>
	);
}

function CommentItem({ comment, currentUser, userCache, onDelete, onReply, replyContent, setReplyContent, token, depth = 0 }) {
	const [showReplyForm, setShowReplyForm] = useState(false);
	const isCommentOwner = currentUser && comment.userId === currentUser.id;
	const author = userCache[comment.userId] || { name: 'Loading...', email: '' };
	const replyText = replyContent[comment.id] || '';
	
	return (
		<div className="comment" style={{ marginLeft: depth > 0 ? '20px' : '0', borderLeft: depth > 0 ? '2px solid #e0e0e0' : 'none', paddingLeft: depth > 0 ? '12px' : '0' }}>
			<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
				<div style={{ flex: 1 }}>
					<div className="comment-content" style={{ marginBottom: '4px' }}>{comment.content}</div>
					<div style={{ fontSize: '12px', color: '#666', display: 'flex', gap: '12px', alignItems: 'center' }}>
						<span>By: {author.name || 'Unknown User'}</span>
						{comment.createdAt && (
							<span>{formatDate(comment.createdAt)}</span>
						)}
						{token && (
							<button 
								className="btn-link" 
								onClick={() => setShowReplyForm(!showReplyForm)}
								style={{ padding: '0', fontSize: '12px', textDecoration: 'none' }}
							>
								{showReplyForm ? 'Cancel' : 'Reply'}
							</button>
						)}
					</div>
				</div>
				{isCommentOwner && (
					<button 
						className="btn btn-danger btn-sm" 
						onClick={() => onDelete(comment.id, comment.parentId)}
						style={{ marginLeft: '8px', padding: '4px 8px', fontSize: '12px' }}
						title="Delete comment"
					>
						🗑️
					</button>
				)}
			</div>
			{showReplyForm && token && (
				<form onSubmit={(e) => { onReply(e, comment.id); setShowReplyForm(false); }} className="form inline" style={{ marginTop: '8px', marginBottom: '12px' }}>
					<input 
						className="input" 
						placeholder="Write a reply…" 
						value={replyText} 
						onChange={e => setReplyContent({ ...replyContent, [comment.id]: e.target.value })}
						style={{ flex: 1, marginRight: '10px', fontSize: '14px' }}
					/>
					<button className="btn btn-primary" type="submit" disabled={!replyText.trim()} style={{ fontSize: '14px', padding: '6px 12px' }}>
						Reply
					</button>
				</form>
			)}
			{comment.replies && comment.replies.length > 0 && (
				<div style={{ marginTop: '12px' }}>
					{comment.replies.map(reply => (
						<CommentItem 
							key={reply.id} 
							comment={reply} 
							currentUser={currentUser}
							userCache={userCache}
							onDelete={onDelete}
							onReply={onReply}
							replyContent={replyContent}
							setReplyContent={setReplyContent}
							token={token}
							depth={depth + 1}
						/>
					))}
				</div>
			)}
		</div>
	);
}

function PostCard({ post, token, userCache: initialUserCache, currentUser, onPostDelete }) {
	const [comments, setComments] = useState([]);
	const [content, setContent] = useState('');
	const [replyContent, setReplyContent] = useState({});
	const [error, setError] = useState('');
	const [showComments, setShowComments] = useState(true);
	const [deleting, setDeleting] = useState(false);
	const [userCache, setUserCache] = useState(initialUserCache || {});
	const author = userCache[post.userId] || { name: 'Loading...', email: '' };
	const isOwner = currentUser && post.userId === currentUser.id;
	const headers = useMemo(() => ({
		'Content-Type': 'application/json',
		Authorization: token ? `Bearer ${token}` : undefined
	}), [token]);
	
	// Update local userCache when prop changes
	useEffect(() => {
		setUserCache(prev => ({ ...prev, ...initialUserCache }));
	}, [initialUserCache]);
	
	async function loadUser(userId) {
		if (userCache[userId]) return userCache[userId];
		try {
			const url = `${API_BASE}/users/public/${userId}`;
			const res = await fetch(url, { headers });
			if (res.ok) {
				const data = await res.json();
				setUserCache(c => ({ ...c, [userId]: data }));
				return data;
			} else {
				console.error(`Failed to load user ${userId}: ${res.status} ${res.statusText}`);
			}
		} catch (e) {
			console.error(`Error loading user ${userId}:`, e);
		}
		return { name: 'Unknown User', email: '' };
	}
	
	function extractUserIds(comments) {
		const userIds = new Set();
		function traverse(comments) {
			comments.forEach(c => {
				if (c.userId) userIds.add(c.userId);
				if (c.replies && Array.isArray(c.replies)) {
					traverse(c.replies);
				}
			});
		}
		traverse(comments);
		return Array.from(userIds);
	}
	
	async function loadComments(retries = 2) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
			
			const res = await fetch(`${API_BASE}/comments?postId=${post.id}`, { 
				headers,
				signal: controller.signal
			});
			clearTimeout(timeoutId);
			
			// Handle 304 Not Modified (cached response)
			if (res.status === 304) {
				// Response is cached, don't update comments
				setError(''); // Clear any previous errors
				return;
			}
			if (!res.ok) {
				throw new Error(`HTTP ${res.status}: ${res.statusText}`);
			}
			const data = await res.json();
			const comments = Array.isArray(data) ? data : [];
			setComments(comments);
			setError(''); // Clear any previous errors
			// Load user info for all comment authors (including replies)
			const userIds = extractUserIds(comments);
			// Load all users in parallel
			await Promise.all(userIds.map(uid => loadUser(uid)));
		} catch (e) {
			console.error('Failed to load comments:', e);
			// Retry on failure
			if (retries > 0 && e.name !== 'AbortError') {
				console.log(`Retrying comments load... ${retries} attempts left`);
				setTimeout(() => loadComments(retries - 1), 1000);
			} else {
				// Only show error if all retries failed
				setError('Failed to load comments. They will retry automatically.');
				// Auto-clear error after 5 seconds
				setTimeout(() => setError(''), 5000);
			}
		}
	}
	
	useEffect(() => {
		loadComments();
		// Refresh comments every 3 seconds
		const interval = setInterval(loadComments, 3000);
		return () => clearInterval(interval);
	}, [post.id]);
	
	async function submit(e) {
		e.preventDefault();
		if (!content.trim()) return;
		const optimistic = { id: `tmp-${Date.now()}`, postId: post.id, content, parentId: null, createdAt: new Date().toISOString(), replies: [] };
		setComments(c => [...c, optimistic]);
		setContent('');
		try {
			const res = await fetch(`${API_BASE}/comments`, { method: 'POST', headers, body: JSON.stringify({ postId: post.id, content }) });
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			const data = await res.json();
			setComments(c => c.map(x => x.id === optimistic.id ? data : x));
		} catch (e) {
			console.error(e);
			setComments(c => c.filter(x => x.id !== optimistic.id));
			setError('Failed to add comment');
		}
	}
	
	async function submitReply(e, parentId) {
		e.preventDefault();
		const replyText = replyContent[parentId]?.trim() || '';
		if (!replyText) return;
		const optimistic = { id: `tmp-reply-${Date.now()}`, postId: post.id, content: replyText, parentId, createdAt: new Date().toISOString(), replies: [] };
		setComments(c => c.map(comment => {
			if (comment.id === parentId) {
				return { ...comment, replies: [...(comment.replies || []), optimistic] };
			}
			return comment;
		}));
		setReplyContent({ ...replyContent, [parentId]: '' });
		try {
			const res = await fetch(`${API_BASE}/comments`, { 
				method: 'POST', 
				headers, 
				body: JSON.stringify({ postId: post.id, content: replyText, parentId }) 
			});
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			loadComments();
		} catch (e) {
			console.error(e);
			setComments(c => c.map(comment => {
				if (comment.id === parentId) {
					return { ...comment, replies: (comment.replies || []).filter(r => r.id !== optimistic.id) };
				}
				return comment;
			}));
			setError('Failed to add reply');
		}
	}
	
	async function deletePost() {
		if (!confirm('Are you sure you want to delete this post? This will also delete all comments.')) return;
		setDeleting(true);
		try {
			const res = await fetch(`${API_BASE}/posts/${post.id}`, { method: 'DELETE', headers });
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			onPostDelete();
		} catch (e) {
			console.error(e);
			setError('Failed to delete post');
		} finally {
			setDeleting(false);
		}
	}
	
	async function deleteComment(commentId, parentId = null) {
		try {
			const res = await fetch(`${API_BASE}/comments/${commentId}`, { method: 'DELETE', headers });
			if (!res.ok) throw new Error(`Failed (${res.status})`);
			if (parentId) {
				setComments(c => c.map(comment => {
					if (comment.id === parentId) {
						return { ...comment, replies: (comment.replies || []).filter(r => r.id !== commentId) };
					}
					return comment;
				}));
			} else {
				setComments(c => c.filter(x => x.id !== commentId));
			}
		} catch (e) {
			console.error(e);
			setError('Failed to delete comment');
		}
	}
	
	return (
		<div className="card post-card">
			<div className="post-header">
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
					<div style={{ flex: 1 }}>
						<h3 className="title">{post.title}</h3>
						<div className="post-meta">
							<span className="author">By: {author.name || 'Unknown User'}</span>
							{post.createdAt && (
								<span className="date">{formatDate(post.createdAt)}</span>
							)}
						</div>
					</div>
					{isOwner && (
						<button 
							className="btn btn-danger" 
							onClick={deletePost}
							disabled={deleting}
							style={{ marginLeft: '12px' }}
							title="Delete post"
						>
							{deleting ? 'Deleting...' : '🗑️ Delete'}
						</button>
					)}
				</div>
			</div>
			<p className="body">{post.content}</p>
			<div className="divider" />
			<div className="comments-section">
				<button 
					className="btn-link" 
					onClick={() => setShowComments(!showComments)}
					style={{ marginBottom: '10px', cursor: 'pointer' }}
				>
					{showComments ? '▼' : '▶'} Comments ({comments.length})
				</button>
				{showComments && (
					<div className="comments">
						{comments.length === 0 ? (
							<div className="muted" style={{ padding: '10px', fontStyle: 'italic' }}>No comments yet. Be the first to comment!</div>
						) : (
							comments.map(c => (
								<CommentItem 
									key={c.id} 
									comment={c} 
									currentUser={currentUser}
									userCache={userCache}
									onDelete={deleteComment}
									onReply={submitReply}
									replyContent={replyContent}
									setReplyContent={setReplyContent}
									token={token}
								/>
							))
						)}
						{error && <div className="error">{error}</div>}
						<form onSubmit={submit} className="form inline" style={{ marginTop: '15px' }}>
							<input 
								className="input" 
								placeholder="Write a comment…" 
								value={content} 
								onChange={e => setContent(e.target.value)}
								style={{ flex: 1, marginRight: '10px' }}
							/>
							<button className="btn btn-primary" type="submit" disabled={!content.trim()}>
								Comment
							</button>
						</form>
					</div>
				)}
			</div>
		</div>
	);
}

function App() {
	const auth = useAuth();
	if (!auth.token) {
		return <LoginRegister onAuthed={auth.saveAuth} />;
	}
	return <Feed token={auth.token} user={auth.user} onLogout={auth.logout} onUserUpdate={auth.updateUser} />;
}

createRoot(document.getElementById('root')).render(<App />);


