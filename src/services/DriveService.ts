import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export class DriveService {
  private drive: any;

  constructor() {
    // Use OAuth credentials (same as Python version)
    const oauthPath = process.env.GOOGLE_OAUTH_CREDENTIALS_PATH || '../credentials/oauth-credentials.json';
    const tokenPath = '../credentials/token.json';
    
    const credentials = JSON.parse(fs.readFileSync(oauthPath, 'utf-8'));
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));

    // Support both 'installed' and 'web' credential formats
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
