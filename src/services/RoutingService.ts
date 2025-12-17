import { google } from 'googleapis';
import * as fs from 'fs';

export interface RoutingRule {
  lineGroupId: string;
  lineGroupName?: string;
  driveFolderId: string;
  driveFolderName?: string;
  adminUserEmail: string;
  enabled: boolean;
  notes?: string;
}

export class RoutingService {
  private sheets: any;
  private spreadsheetId: string;
  private sheetName: string;

  constructor() {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.spreadsheetId = process.env.ROUTING_SPREADSHEET_ID || '';
    this.sheetName = process.env.ROUTING_SHEET_NAME || 'Sheet1';
  }

  async findRouting(groupId: string): Promise<RoutingRule | null> {
    try {
      const range = `${this.sheetName}!A:H`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length === 0) {
        console.log('No data found in spreadsheet');
        return null;
      }

      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const rowGroupId = row[0]?.trim();

        if (rowGroupId === groupId) {
          const enabled = row[5];
          if (enabled === false || enabled === 'FALSE' || enabled === 'false') {
            console.log('Routing rule is disabled');
            return null;
          }

          return {
            lineGroupId: rowGroupId,
            lineGroupName: row[1] || undefined,
            driveFolderId: row[2],
            driveFolderName: row[3] || undefined,
            adminUserEmail: row[4], // Column E (index 4)
            enabled: true,
            notes: row[6] || undefined,
          };
        }
      }

      console.log(`No routing rule found for group ID: ${groupId}`);
      return null;
    } catch (error) {
      console.error('Error finding routing:', error);
      return null;
    }
  }

  async getAllGroups(): Promise<any[]> {
    try {
      const range = `${this.sheetName}!A:H`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return [];
      }

      // Skip header row, return all groups
      return rows.slice(1).map((row: any[]) => ({
        groupId: row[0],
        groupName: row[1],
        driveFolderId: row[2],
        folderName: row[3],
        email: row[4],
        enabled: row[5] !== 'FALSE' && row[5] !== 'false' && row[5] !== false,
        platform: row[7] || 'lineworks', // Column H (index 7)
      })).filter((group: any) => group.groupId); // Filter out empty rows
    } catch (error) {
      console.error('Error getting all groups:', error);
      throw error;
    }
  }

  async enableGroup(groupId: string): Promise<{ found: boolean; groupName?: string }> {
    try {
      const range = `${this.sheetName}!A:H`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        return { found: false };
      }

      // Find the row with matching group ID
      let rowIndex = -1;
      let groupName = '';
      
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === groupId) {
          rowIndex = i;
          groupName = rows[i][1] || 'Unknown Group';
          break;
        }
      }

      if (rowIndex === -1) {
        return { found: false };
      }

      // Update the "Enabled" column (F, index 5) to TRUE
      const updateRange = `${this.sheetName}!F${rowIndex + 1}`;
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: updateRange,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['TRUE']],
        },
      });

      console.log(`✅ Group enabled: ${groupName} (${groupId})`);
      return { found: true, groupName };
    } catch (error) {
      console.error('Error enabling group:', error);
      throw error;
    }
  }

  async deleteGroup(groupId: string, platform: string): Promise<void> {
    try {
      const range = `${this.sheetName}!A:H`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
        throw new Error('Group not found');
      }

      // Find the row to delete
      let rowIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (rows[i][0] === groupId && rows[i][7] === platform) {
          rowIndex = i;
          break;
        }
      }

      if (rowIndex === -1) {
        throw new Error('Group not found');
      }

      // Delete the row (rowIndex + 1 because sheets are 1-indexed)
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [{
            deleteDimension: {
              range: {
                sheetId: 0,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          }],
        },
      });

      console.log(`✅ Group deleted: ${groupId}`);
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }
}
