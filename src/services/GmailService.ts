import { google } from 'googleapis';
import * as fs from 'fs';

export class GmailService {
  private gmail: any;

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
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
      });

      this.gmail = google.gmail({ version: 'v1', auth });
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

      this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    }
  }

  async sendUploadNotification(
    toEmail: string,
    groupName: string,
    folderName: string,
    fileName: string,
    fileLink: string,
    folderLink: string
  ): Promise<boolean> {
    try {
      const htmlBody = `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #06C755; border-bottom: 2px solid #06C755; padding-bottom: 10px;">
                📎 New File Uploaded
              </h2>
              
              <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Group:</strong> ${groupName}</p>
                <p style="margin: 5px 0;"><strong>File:</strong> ${fileName}</p>
                <p style="margin: 5px 0;"><strong>Folder:</strong> ${folderName}</p>
              </div>
              
              <div style="margin: 20px 0;">
                <a href="${fileLink}" 
                   style="display: inline-block; background-color: #06C755; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px; margin-right: 10px;">
                  📄 View File
                </a>
                <a href="${folderLink}" 
                   style="display: inline-block; background-color: #4285F4; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 5px;">
                  📁 Open Folder
                </a>
              </div>
              
              <p style="margin-top: 30px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 15px;">
                This is an automated notification from LINE Webhook Integration System.
              </p>
            </div>
          </body>
        </html>
      `;

      const plainBody = `
New File Uploaded

Group: ${groupName}
File: ${fileName}
Folder: ${folderName}

View File: ${fileLink}
Open Folder: ${folderLink}

---
This is an automated notification from LINE Webhook Integration System.
      `;

      // Create email in RFC 2822 format
      const utf8Subject = `=?utf-8?B?${Buffer.from(`📎 New File Upload: ${fileName}`).toString('base64')}?=`;
      const messageParts = [
        `From: ${process.env.GMAIL_SENDER_EMAIL}`,
        `To: ${toEmail}`,
        `Subject: ${utf8Subject}`,
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="boundary-string"',
        '',
        '--boundary-string',
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        plainBody,
        '',
        '--boundary-string',
        'Content-Type: text/html; charset="UTF-8"',
        '',
        htmlBody,
        '',
        '--boundary-string--',
      ];

      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`📧 Notification sent to: ${toEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  }
}
