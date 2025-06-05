// server/scripts/bootstrap-admin.js
// This is a one-time use script to create the first admin.
import admin from 'firebase-admin';
// Use a relative path to go up one directory to find the key file
import serviceAccount from '../firebase-service-account-key.json' assert { type: 'json' };

// The email address of the user to make an admin
const emailToMakeAdmin = 'graciegould5@gmail.com';

// Initialize the Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function setAdminClaim() {
  try {
    console.log(`Finding user: ${emailToMakeAdmin}...`);
    const user = await admin.auth().getUserByEmail(emailToMakeAdmin);

    console.log(`Setting custom claim { isAdmin: true } for user ${user.uid}...`);
    await admin.auth().setCustomUserClaims(user.uid, { isAdmin: true });

    console.log('✅ Success! Gracie Gould (graciegould5@gmail.com) has been made an admin.');
    console.log('IMPORTANT: You must now log out and log back into the web app for the change to take effect.');
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`❌ Error: The user with email "${emailToMakeAdmin}" was not found in Firebase Authentication.`);
      console.error('Please make sure you have created this user in the Firebase Console first.');
    } else {
      console.error('❌ An unexpected error occurred:', error);
    }
    process.exit(1);
  }
}

setAdminClaim(); 