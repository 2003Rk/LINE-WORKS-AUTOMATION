import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export class DriveService {
  private drive: any;

  constructor() {
    // Use Service Account from environment variables (production-ready)
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (serviceAccountEmail && privateKey) {
      // Production: Use Service Account from env vars
      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: serviceAccountEmail,
          private_key: privateKey.replace(/\\n/g, '\n'),
        },
        scopes: ['https://www.googleapis.com/auth/drive.file'],
      });

      this.drive = google.drive({ version: 'v3', auth });
    } else {
      // Development: Use OAuth credentials from files
      const oauthPath = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || '../credentials/oauth-credentials.json';
      const tokenPath = '../credentials/token.json';
      
      const credentials = JSON.parse(fs.readFileSync(oauthPath, 'utf-8'));
      const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

      const credType = credentials.installed || credentials.web;
      const redirectUri = credType.redirect_uris?.[0] || 'http://localhost';

      const oauth2Client = new google.auth.OAuth2(
        credType.client_id,
        credType.client_secret,
        redirectUri
      );

      oauth2Client.setCredentials(token);

      this.drive = google.drive({ version: 'v3', auth: oauth2Client });
    }
  }

  async uploadFile(
    filePath: string,
    folderId: string
  ): Promise<{ fileId: string; fileName: string } | null> {
    try {
      const fileName = path.basename(filePath);
      
      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const media = {
        mimeType: 'application/octet-stream',
        body: fs.createReadStream(filePath),
      };

      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name',
      });

      console.log(`✅ File uploaded to Drive: ${response.data.name} (ID: ${response.data.id})`);

      return {
        fileId: response.data.id,
        fileName: response.data.name,
      };
    } catch (error) {
      console.error('❌ Error uploading to Drive:', error);
      return null;
    }
  }
}
