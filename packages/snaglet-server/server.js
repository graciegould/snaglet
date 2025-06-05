import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import admin from 'firebase-admin';
import dotenv from 'dotenv';

// --- Path and Environment Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });
// --- End Path and Environment Setup ---

// --- Firebase Admin SDK Initialization ---
// Note: Assumes the service account key file is in the 'server/' directory.
import serviceAccount from './firebase-service-account-key.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore(); // Get a Firestore instance from the Admin SDK
// --- End Firebase Admin SDK Initialization ---

// --- Authentication Middleware ---
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).json({ error: 'Unauthorized: No token provided' });
  }
  
  const idToken = authHeader.split('Bearer ')[1];
  
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // Add user info to the request object
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(403).json({ error: 'Unauthorized: Invalid token' });
  }
};
// --- End Authentication Middleware ---

// --- Admin-Only Middleware ---
// This middleware should be used after verifyFirebaseToken
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin === true) {
    next(); // User is an admin, proceed
  } else {
    res.status(403).json({ error: 'Forbidden: Admin privileges required' });
  }
};
// --- End Admin-Only Middleware ---

const app = express();

async function startServer() {
  app.use(express.json({ limit: '10mb' }));
  
  // --- API Routes ---
  // Public route - does not require authentication
  app.get('/api/public-data', async (req, res) => {
    try {
      const snapshot = await db.collection('public_content').get(); // Using the public collection
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(data);
    } catch (error) {
      console.error('Failed to fetch public data:', error);
      res.status(500).json({ error: 'Failed to fetch data' });
    }
  });

  // Secure route - requires authentication via our middleware
  app.post('/api/secure-action', verifyFirebaseToken, async (req, res) => {
    // Because of the middleware, we know req.user exists and is valid.
    const uid = req.user.uid;
    const userEmail = req.user.email;
    const requestBody = req.body;

    console.log(`Performing secure action for user: ${userEmail} (${uid})`);
    
    // Here you would perform your trusted server-side logic.
    // For example, interacting with another API, or performing a complex DB write.
    // This example just returns a success message.
    res.json({ 
      message: `Successfully performed secure action for ${userEmail}`,
      yourData: requestBody 
    });
  });

  // --- New Admin-Only Route ---
  // This endpoint sets a custom claim on a user to make them an admin.
  // It is protected by two layers of middleware:
  // 1. verifyFirebaseToken: Ensures the user is logged in.
  // 2. requireAdmin: Ensures the logged-in user is already an admin.
  app.post('/api/set-admin-claim', [verifyFirebaseToken, requireAdmin], async (req, res) => {
    const { emailToMakeAdmin } = req.body;

    if (!emailToMakeAdmin) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      // Find the user by email using the Admin SDK
      const userToUpdate = await admin.auth().getUserByEmail(emailToMakeAdmin);
      
      // Set the custom claim
      await admin.auth().setCustomUserClaims(userToUpdate.uid, { isAdmin: true });
      
      res.json({ message: `Success! ${emailToMakeAdmin} has been made an admin.` });
    } catch (error) {
      console.error('Error setting custom claim:', error);
      res.status(500).json({ error: 'Failed to set admin claim. User may not exist.' });
    }
  });
  // --- End API Routes ---

  // --- Frontend Serving Logic ---
  if (process.env.NODE_ENV === 'production') {
    // For production, serve different static files based on hostname
    app.use((req, res, next) => {
      const hostname = req.hostname;
      if (hostname === 'exec.localhost') { // Or your real admin subdomain
        // Serve the admin app
        express.static(path.join(projectRoot, 'packages', 'snaglet-exec', 'dist'))(req, res, next);
      } else {
        // Serve the main app
        express.static(path.join(projectRoot, 'packages', 'snaglet-app', 'dist'))(req, res, next);
      }
    });

    // Catch-all for single-page applications
    // This sends the correct index.html for deep links
    app.get('*', (req, res) => {
      const hostname = req.hostname;
      if (hostname === 'exec.localhost') {
        res.sendFile(path.join(projectRoot, 'packages', 'snaglet-exec', 'dist', 'index.html'));
      } else {
        res.sendFile(path.join(projectRoot, 'packages', 'snaglet-app', 'dist', 'index.html'));
      }
    });

  } else {
    // --- Development Logic ---
    // In development, we create two separate Vite servers
    // and use middleware to route to the correct one based on hostname.
    const viteModule = await import('vite');

    // Create a Vite server for the main app
    const viteApp = await viteModule.createServer({
      root: path.join(projectRoot, 'packages', 'snaglet-app'),
      server: { 
        middlewareMode: true,
        hmr: {
          // Explicitly define a port for the main app's HMR server
          port: 24677
        }
      },
      appType: 'spa',
    });

    // Create a Vite server for the exec app
    const viteExec = await viteModule.createServer({
      root: path.join(projectRoot, 'packages', 'snaglet-exec'),
      server: { 
        middlewareMode: true,
        // We need to specify a different HMR port for the second Vite instance
        // to avoid conflicts with the first one.
        hmr: { port: 24678 } 
      },
      appType: 'spa',
    });

    // Use a custom middleware to route requests to the correct Vite server
    app.use((req, res, next) => {
      const hostname = req.hostname;
      if (hostname === 'exec.localhost') {
        viteExec.middlewares(req, res, next);
      } else {
        viteApp.middlewares(req, res, next);
      }
    });
  }

  // Basic error handler
  app.use((err, req, res, next) => {
    console.error('Server Error:', err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
  });

  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Vite frontend should be available through this server on port ${PORT}`);
    }
  });
}

startServer(); 