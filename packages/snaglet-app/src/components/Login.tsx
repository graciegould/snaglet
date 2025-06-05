// src/components/AdminLogin.tsx
import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../lib/firebase'; // Adjust path if needed

interface LoginProps {
  onAuthStateChange: (user: User | null) => void;
}

const Login: React.FC<LoginProps> = ({ onAuthStateChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      onAuthStateChange(user); // Notify parent component
    });
    return () => unsubscribe(); // Cleanup subscription on unmount
  }, [onAuthStateChange]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError('Failed to log in. Check credentials.');
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  if (currentUser) {
    return (
      <div style={{ padding: '10px', border: '1px solid green', margin: '10px 0' }}>
        <p>Logged in as: {currentUser.email}</p>
        <button onClick={handleLogout}>Log Out</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleLogin} style={{ padding: '10px', border: '1px solid #ccc', margin: '10px 0' }}>
      <h3>User Login</h3>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
      <button type="submit">Log In</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </form>
  );
};

export default Login; 