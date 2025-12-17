import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';
import express from 'express';
import open from 'open';
import dotenv from 'dotenv';

dotenv.config();

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets'
];

async function generateToken() {
  try {
    // Read OAuth credentials
    const oauthPath = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || '../credentials/oauth-credentials.json';
    const credentialsPath = path.resolve(oauthPath);
    const tokenPath = path.resolve('../credentials/token.json');
    
    if (!fs.existsSync(credentialsPath)) {
      console.error('❌ OAuth credentials file not found at:', credentialsPath);
      process.exit(1);
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
    
    // Support both 'installed' and 'web' credential formats
    const credType = credentials.installed || credentials.web;
    if (!credType) {
      console.error('❌ Invalid credentials format. Expected "installed" or "web" property.');
      process.exit(1);
    }

    const redirectUri = 'http://localhost:8080';

    console.log('📝 Using redirect URI:', redirectUri);
    console.log('⚠️  Make sure this URI is added to your OAuth Client in Google Cloud Console!\n');

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      credType.client_id,
      credType.client_secret,
      redirectUri
    );

    // Generate authorization URL
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    // Create a temporary server to receive the auth code
    const app = express();
    let server: any;

    const tokenPromise = new Promise<void>((resolve, reject) => {
      app.get('/', (req, res) => {
        const code = req.query.code as string;
        
        if (!code) {
          res.send('❌ Error: No authorization code received. Please try again.');
          reject(new Error('No authorization code received'));
          return;
        }

        // Exchange code for token
        oauth2Client.getToken(code)
          .then(({ tokens }) => {
            // Save token to file
            fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
            
            res.send('✅ Success! Token generated. You can close this window and return to the terminal.');
            console.log('\n✅ Token generated successfully!');
            console.log('📁 Token saved to:', tokenPath);
            console.log('\n✓ You can now run your server with: npm run dev\n');
            
            // Close server after a short delay
            setTimeout(() => {
              server.close();
              resolve();
            }, 1000);
          })
          .catch((error) => {
            res.send('❌ Error exchanging authorization code. Check the terminal for details.');
            console.error('❌ Error exchanging authorization code:', error.message);
            server.close();
            reject(error);
          });
      });

      server = app.listen(8080, () => {
        console.log('🌐 Temporary server started on http://localhost:8080');
        console.log('🔐 Opening browser for authorization...\n');
        
        // Open the browser
        open(authUrl).catch(() => {
          console.log('⚠️  Could not open browser automatically.');
          console.log('Please visit this URL:\n');
          console.log(authUrl);
          console.log('\n');
        });
      });
    });

    await tokenPromise;
  } catch (error) {
    console.error('❌ Error generating token:', error);
    process.exit(1);
  }
}

generateToken();
