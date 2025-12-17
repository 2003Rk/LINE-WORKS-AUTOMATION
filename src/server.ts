import express from 'express';
import dotenv from 'dotenv';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { StorageService } from './services/StorageService';
import { LineClient } from './services/LineClient';
import { LineWorksClient } from './services/LineWorksClient';
import { DriveService } from './services/DriveService';
import { GmailService } from './services/GmailService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// SSE clients for real-time logs
let sseClients: express.Response[] = [];

// Log function that sends to both console and SSE clients
function logToClients(message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, type };
  
  // Log to console
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type];
  console.log(`${emoji} ${message}`);
  
  // Send to all connected SSE clients
  sseClients.forEach(client => {
    client.write(`data: ${JSON.stringify(logEntry)}\n\n`);
  });
}

// Initialize services
const storage = new StorageService();
const lineClient = new LineClient();
const lineWorksClient = new LineWorksClient();
const driveService = new DriveService();
const gmailService = new GmailService();

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// SSE endpoint for real-time logs
app.get('/api/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  
  // Add this client to the list
  sseClients.push(res);
  logToClients('Client connected to log stream', 'info');
  
  // Remove client on disconnect
  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
    console.log('Client disconnected from log stream');
  });
});

// START endpoint - processes webhooks manually
app.post('/api/start', async (req, res) => {
  logToClients('🚀 START button pressed - Beginning processing...', 'info');
  
  // Send immediate response
  res.json({ status: 'started', message: 'Processing started. Check logs for progress.' });
  
  // Process asynchronously
  setTimeout(async () => {
    try {
      logToClients('📋 Loading group configurations from storage...', 'info');
      const groups = storage.getAllGroups();
      
      if (groups.length === 0) {
        logToClients('No groups configured. Please add groups first.', 'warning');
        return;
      }
      
      logToClients(`Found ${groups.length} configured group(s)`, 'success');
      
      groups.forEach(group => {
        const status = group.enabled ? '✓ Active' : '⏸ Disabled';
        logToClients(`  ${status} - ${group.groupName} (${group.platform.toUpperCase()}) → ${group.folderName}`, 'info');
      });
      
      logToClients('✅ Ready to process incoming webhooks', 'success');
      logToClients('Waiting for file uploads from LINE/LINE WORKS...', 'info');
      
    } catch (error: any) {
      logToClients(`Error: ${error.message}`, 'error');
    }
  }, 100);
});

// API: Get all groups
app.get('/api/groups', (req, res) => {
  try {
    const groups = storage.getAllGroups();
    res.json({ groups });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Check if group exists
app.get('/api/groups/check/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;
    const group = storage.findGroup(groupId);
    res.json({ exists: !!group });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Add new group
app.post('/api/groups', (req, res) => {
  try {
    const { groupId, groupName, platform, driveFolderId, folderName, email, enabled } = req.body;
    
    if (!groupId || !groupName || !platform || !driveFolderId || !folderName || !email) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    storage.addGroup({
      groupId,
      groupName,
      platform,
      driveFolderId,
      folderName,
      email,
      enabled: enabled !== false
    });
    
    res.json({ success: true, message: 'Group added successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Delete group
app.delete('/api/groups', (req, res) => {
  try {
    const { groupId } = req.body;
    
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }
    
    storage.deleteGroup(groupId);
    res.json({ success: true, message: 'Group deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: Toggle group enabled status
app.patch('/api/groups/:groupId/toggle', (req, res) => {
  try {
    const { groupId } = req.params;
    const enabled = storage.toggleEnabled(groupId);
    res.json({ success: true, enabled });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// LINE WORKS webhook endpoint
app.post('/webhooks/lineworks', async (req, res) => {
  const signature = req.headers['x-works-signature'] as string;
  const body = JSON.stringify(req.body);
  
  // Verify signature
  const channelSecret = process.env.LINEWORKS_CHANNEL_SECRET;
  if (!signature || !channelSecret || !LineWorksClient.verifySignature(signature, body, channelSecret)) {
    logToClients('LINE WORKS webhook: Invalid signature', 'error');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  logToClients('LINE WORKS webhook received - Signature verified', 'success');
  
  const payload = req.body;
  const processedEvents: any[] = [];
  
  // LINE WORKS sends a single event object (not an array)
  const event = payload;
  
  try {
    const sourceType = event.source?.type || 'channel';
    const userId = event.source?.userId;
    const groupId = event.source?.roomId || event.source?.channelId;
    
    logToClients(`Processing LINE WORKS event - Type: ${event.type}, Source: ${sourceType}, Group: ${groupId}`, 'info');
    
    // Check if this is a file upload event
    const hasFile = event.content && 
                   (event.content.type === 'file' || 
                    event.content.type === 'image' ||
                    event.content.type === 'video' ||
                    event.content.type === 'audio') &&
                   event.content.fileId;
    
    if (hasFile && event.content.fileId) {
      logToClients(`📎 LINE WORKS file detected - File ID: ${event.content.fileId}`, 'info');
      
      // F-01: Download file from LINE WORKS
      const fileBuffer = await lineWorksClient.downloadFileContent(event.content.fileId);
      
      if (!fileBuffer) {
        logToClients('Failed to download file from LINE WORKS', 'error');
        processedEvents.push({
          userId,
          groupId,
          type: event.content.type,
          status: 'download_failed'
        });
      } else {
        // Use original filename if available, otherwise generate with proper extension
        let fileName = event.content.fileName;
        
        if (!fileName) {
          // Get file extension based on content type
          const extMap: { [key: string]: string } = {
            'image': '.jpg',
            'video': '.mp4',
            'audio': '.mp3',
            'file': '.bin'
          };
          const ext = extMap[event.content.type] || '.bin';
          fileName = `lineworks_${event.content.type}_${event.content.fileId.substring(0, 20)}_${Date.now()}${ext}`;
        }
        
        logToClients(`File downloaded: ${fileName} (${fileBuffer.length} bytes)`, 'success');
        
        // Save to local downloads/temp folder
        const tempDir = path.join(__dirname, '../../downloads/temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        const localFilePath = path.join(tempDir, fileName);
        fs.writeFileSync(localFilePath, fileBuffer);
        logToClients(`💾 Saved locally: ${localFilePath}`, 'info');
        
        // F-02: Lookup routing rule (only for groups/rooms)
        if (!groupId) {
          logToClients('Not a group message - skipping routing', 'warning');
          processedEvents.push({
            userId,
            type: event.content.type,
            status: 'not_group_message'
          });
        } else {
          const group = storage.findGroup(groupId);
          
          if (!group || !group.enabled) {
            logToClients(`Silent skip: No active group for ${groupId}`, 'warning');
            processedEvents.push({
              userId,
              groupId,
              type: event.content.type,
              status: 'no_active_group'
            });
          } else {
            logToClients(`Group matched: ${group.groupName} → Drive: ${group.folderName}`, 'success');
            
            // F-04 & F-05: Upload to Google Drive
            const uploadResult = await driveService.uploadFile(
              localFilePath,
              group.driveFolderId
            );
            
            if (!uploadResult) {
              logToClients('Failed to upload to Drive', 'error');
              processedEvents.push({
                userId,
                groupId,
                type: event.content.type,
                status: 'upload_failed'
              });
            } else {
              logToClients(`File uploaded to Drive: ${uploadResult.fileName} (ID: ${uploadResult.fileId})`, 'success');
              
              const eventData: any = {
                userId,
                groupId,
                sourceType,
                type: event.content.type,
                fileId: event.content.fileId,
                fileSize: fileBuffer.length,
                status: 'uploaded_to_drive',
                driveFileId: uploadResult.fileId,
                driveFileName: uploadResult.fileName,
                driveFolderId: group.driveFolderId,
                driveFolderName: group.folderName
              };
              
              // F-06: Send notification email
              if (group.email) {
                try {
                  const fileLink = `https://drive.google.com/file/d/${uploadResult.fileId}/view`;
                  const folderLink = `https://drive.google.com/drive/folders/${group.driveFolderId}`;
                  
                  const emailSent = await gmailService.sendUploadNotification(
                    group.email,
                    group.groupName || groupId,
                    group.folderName || 'Google Drive',
                    uploadResult.fileName,
                    fileLink,
                    folderLink
                  );
                  
                  eventData.notificationSent = emailSent;
                  if (emailSent) {
                    logToClients(`📧 Notification sent to: ${group.email}`, 'success');
                  }
                } catch (error) {
                  logToClients(`Error sending notification: ${error}`, 'error');
                  eventData.notificationSent = false;
                }
              } else {
                logToClients('No notification email configured for this group', 'warning');
                eventData.notificationSent = false;
              }
              
              processedEvents.push(eventData);
            }
          }
        }
      }
      
    } else {
      // Non-file message
      processedEvents.push({
        userId,
        groupId,
        type: event.content?.type || event.type,
        status: 'not_file_message'
      });
    }
    
  } catch (error) {
    console.error('Error processing LINE WORKS event:', error);
    processedEvents.push({
      status: 'error',
      error: String(error)
    });
  }
  
  res.json({
    status: 'success',
    message: 'LINE WORKS webhook received and verified',
    eventsProcessed: processedEvents.length,
    events: processedEvents
  });
});

// Signature verification
function verifySignature(signature: string, body: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) return false;
  
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 LINE WORKS webhook: http://localhost:${PORT}/webhooks/lineworks`);
});
