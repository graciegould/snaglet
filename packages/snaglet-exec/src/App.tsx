import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import Login from './components/Login';

interface PublicContent {
  id: string;
  message: string;
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [publicContent, setPublicContent] = useState<PublicContent[]>([]);
  const [serverMessage, setServerMessage] = useState('');
  const [adminPanelMessage, setAdminPanelMessage] = useState('');
  const [emailToMakeAdmin, setEmailToMakeAdmin] = useState('');

  // Client-side Firestore listener (reads public data)
  useEffect(() => {
    const publicContentRef = collection(db, 'public_content');
    const unsubscribe = onSnapshot(publicContentRef, (snapshot) => {
      const content = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PublicContent));
      setPublicContent(content);
    });
    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  // Updated auth state handler to check for admin claims
  const handleAuthStateChange = async (user: User | null) => {
    setCurrentUser(user);
    if (user) {
      // Check for admin custom claim
      const idTokenResult = await user.getIdTokenResult();
      setIsAdmin(idTokenResult.claims.isAdmin === true);

      const userDocRef = doc(db, 'users', user.uid);
      setDoc(userDocRef, { email: user.email, lastLogin: new Date() }, { merge: true });
    } else {
      setIsAdmin(false); // Not logged in, so not an admin
    }
  };
  
  // Call secure server endpoint
  const callSecureEndpoint = async () => {
    if (!currentUser) {
      setServerMessage('You must be logged in to do this.');
      return;
    }
    setServerMessage('Calling secure endpoint...');
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/secure-action', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ myData: 'Hello from client!' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to call secure endpoint');
      setServerMessage(data.message);
    } catch (error) {
      console.error(error);
      setServerMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
    }
  };

  // Function to call the set-admin-claim endpoint
  const handleMakeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !emailToMakeAdmin) return;
    setAdminPanelMessage('Processing...');
    
    try {
      const idToken = await currentUser.getIdToken();
      const response = await fetch('/api/set-admin-claim', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailToMakeAdmin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to set admin claim');
      setAdminPanelMessage(data.message);
    } catch (error) {
      console.error(error);
      setAdminPanelMessage(error instanceof Error ? error.message : 'An unknown error occurred.');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Hybrid Firebase Model Demo: SNAGLET EXEC</h1>
      <Login onAuthStateChange={handleAuthStateChange} />
      <hr />
      
      {/* Admin Panel - only visible if user is an admin */}
      {isAdmin && (
        <div style={{ border: '2px solid gold', padding: '10px', margin: '10px 0' }}>
          <h2>Admin Panel</h2>
          <form onSubmit={handleMakeAdmin}>
            <p>Enter the email of the user you want to make an admin:</p>
            <input 
              type="email" 
              value={emailToMakeAdmin}
              onChange={(e) => setEmailToMakeAdmin(e.target.value)}
              placeholder="user@example.com"
              required
            />
            <button type="submit">Make Admin</button>
          </form>
          {adminPanelMessage && <p><strong>Status:</strong> {adminPanelMessage}</p>}
        </div>
      )}

      <div>
        <h2>1. Client-Side Read (Public Data)</h2>
        <p>This data is read directly from Firestore by the client. Rules allow public read access.</p>
        <ul>
          {publicContent.map(item => <li key={item.id}>{item.message}</li>)}
        </ul>
      </div>
      <hr />

      <div>
        <h2>2. Server-Side Secure Action</h2>
        <p>This button calls our private Express server. The server verifies the user's ID token before performing a privileged action.</p>
        <button onClick={callSecureEndpoint} disabled={!currentUser}>
          Perform Secure Action
        </button>
        {serverMessage && <p><strong>Server response:</strong> {serverMessage}</p>}
      </div>
      {currentUser && (
        <p style={{ marginTop: '20px' }}>
          When you logged in, a client-side write updated your document in the 'users' collection with your last login time.
          This was allowed by the security rules because you were authenticated and writing to your own document.
        </p>
      )}
    </div>
  );
}

export default App; 