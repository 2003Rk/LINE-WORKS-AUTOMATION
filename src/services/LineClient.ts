import axios from 'axios';

export class LineClient {
  private accessToken: string;

  constructor() {
    this.accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  }

  async downloadFileContent(messageId: string): Promise<Buffer | null> {
    try {
      const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      if (response.status !== 200) {
        console.log(`Failed to download file: ${response.statusText}`);
        return null;
      }

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Error downloading file from LINE:', error);
      return null;
    }
  }
}
