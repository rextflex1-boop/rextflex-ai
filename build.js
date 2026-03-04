const fs = require('fs');
const path = require('path');

const requiredEnvVars = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_DATABASE_URL',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
  'FIREBASE_MEASUREMENT_ID'
];

const envVars = {};
for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`Missing environment variable: ${varName}`);
    process.exit(1);
  }
  envVars[varName] = process.env[varName];
}

const configContent = `// Auto-generated firebase config
window.firebaseConfig = {
  apiKey: "${envVars.FIREBASE_API_KEY}",
  authDomain: "${envVars.FIREBASE_AUTH_DOMAIN}",
  databaseURL: "${envVars.FIREBASE_DATABASE_URL}",
  projectId: "${envVars.FIREBASE_PROJECT_ID}",
  storageBucket: "${envVars.FIREBASE_STORAGE_BUCKET}",
  messagingSenderId: "${envVars.FIREBASE_MESSAGING_SENDER_ID}",
  appId: "${envVars.FIREBASE_APP_ID}",
  measurementId: "${envVars.FIREBASE_MEASUREMENT_ID}"
};
`;

const outputPath = path.join(__dirname, 'public', 'firebase-config.js');
fs.writeFileSync(outputPath, configContent, 'utf8');
console.log('✅ Firebase config generated at', outputPath);
