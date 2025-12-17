import axios from 'axios';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

export class LineWorksClient {
  private botId: string;
  private apiId: string;
  private consumerKey: string;
  private channelSecret: string;
  private serviceAccount: string;
  private privateKey: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.botId = process.env.LINEWORKS_BOT_ID || '';
    this.apiId = process.env.LINEWORKS_API_ID || '';
    this.consumerKey = process.env.LINEWORKS_CONSUMER_KEY || '';
    this.channelSecret = process.env.LINEWORKS_CHANNEL_SECRET || '';
    this.serviceAccount = process.env.LINEWORKS_SERVICE_ACCOUNT || '';
    // Replace literal \n with actual newlines
    this.privateKey = (process.env.LINEWORKS_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  }

  /**
   * Generate JWT assertion for OAuth token exchange
   */
  private generateJWTAssertion(): string {
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 3600; // Token valid for 1 hour

    const payload = {
      iss: this.apiId,
      sub: this.serviceAccount,
      aud: 'https://auth.worksmobile.com/oauth2/v2.0/token',
      iat: iat,
      exp: exp
    };

    // Create JWT token
    const token = jwt.sign(payload, this.privateKey, {
      algorithm: 'RS256'
    });

    return token;
  }

  /**
   * Get access token (exchanges JWT for OAuth2 access token)
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const assertion = this.generateJWTAssertion();
    
    try {
      const response = await axios.post(
        'https://auth.worksmobile.com/oauth2/v2.0/token',
        new URLSearchParams({
          assertion: assertion,
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          client_id: this.apiId,
          client_secret: this.consumerKey,
          scope: 'bot'
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry 5 minutes before actual expiry
      this.tokenExpiry = Date.now() + ((response.data.expires_in - 300) * 1000);
      
      if (!this.accessToken) {
        throw new Error('Failed to get access token');
      }
      
      return this.accessToken;
    } catch (error: any) {
      console.error('Error getting LINE WORKS access token:', error);
      if (error.response) {
        console.error('OAuth Error Response:', JSON.stringify(error.response.data, null, 2));
        console.error('Request params:', {
          client_id: this.apiId,
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          scope: 'bot'
        });
      }
      throw error;
    }
  }

  /**
   * Download file content from LINE WORKS Message API
   */
  async downloadFileContent(fileId: string): Promise<Buffer | null> {
    try {
      const token = await this.getAccessToken();
      
      const url = `https://www.worksapis.com/v1.0/bots/${this.botId}/attachments/${fileId}`;
      
      // LINE WORKS file download uses automatic redirect handling
      // Preserve Authorization header when following redirects
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        responseType: 'arraybuffer',
        maxRedirects: 5,
        beforeRedirect: (options: any, responseDetails: any) => {
          // Preserve Authorization header across redirects
          options.headers.Authorization = `Bearer ${token}`;
        }
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading file from LINE WORKS:', error);
      return null;
    }
  }

  /**
   * Verify LINE WORKS webhook signature
   */
  static verifySignature(signature: string, body: string, secret: string): boolean {
    const hash = crypto
      .createHmac('SHA256', secret)
      .update(body)
      .digest('base64');
    
    return hash === signature;
  }
}
