# LINE & LINE WORKS Webhook Server

Simple TypeScript webhook server that receives file uploads from LINE Messenger and LINE WORKS, saves them locally, uploads to Google Drive, and sends email notifications.

## 🚀 Quick Start Guide

### Step 1: Install Dependencies

```bash
cd typescript-server
npm install
```

### Step 2: Configure Environment Variables

Make sure your `.env` file has all credentials:



# LINE WORKS Configuration
LINEWORKS_CHANNEL_SECRET=your_lineworks_channel_secret
LINEWORKS_BOT_ID=your_bot_id
LINEWORKS_API_ID=your_api_id
LINEWORKS_CONSUMER_KEY=your_consumer_key
LINEWORKS_SERVICE_ACCOUNT=your_service_account@domain
LINEWORKS_DOMAIN_ID=your_domain_id
LINEWORKS_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----

# Google Sheets Configuration
ROUTING_SPREADSHEET_ID=your_spreadsheet_id
ROUTING_SHEET_NAME=Sheet1

# Google OAuth Credentials
GOOGLE_OAUTH_CREDENTIALS_PATH=../credentials/oauth-credentials.json
GOOGLE_APPLICATION_CREDENTIALS=../credentials/service-account.json

# Server Configuration
PORT=3000
```

### Step 3: Start ngrok

Open a **NEW terminal** and run:

```bash
ngrok http 3000
```

You'll see output like:

```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3000
```

**Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.app`)

### Step 4: Configure Webhooks


#### For LINE WORKS:
1. Go to [LINE WORKS Developer Console](https://developers.worksmobile.com/console/)
2. Select your Bot
3. Go to **Callback URL** section
4. Set **Callback URL** to: `https://YOUR-NGROK-URL.ngrok-free.app/webhooks/lineworks`
5. Save changes

### Step 5: Start the Server

In your **original terminal**:

```bash
npm run dev
```

You should see:

```
🚀 Server running on http://localhost:3000

📡 LINE WORKS webhook: http://localhost:3000/webhooks/lineworks
```

### Step 6: Configure Google Sheets Routing

Open your Google Sheet and add routing rules:

| Group ID | Drive Folder ID | Admin Email | Enabled |
|----------|----------------|-------------|---------|
| your-group-id | google-drive-folder-id | admin@example.com | TRUE |

**Columns:**
- **A**: Group ID (from LINE/LINE WORKS)
- **B**: Google Drive Folder ID (where files will be uploaded)
- **E**: Admin Email (who receives notifications)
- **F**: Enabled (TRUE/FALSE)

### Step 7: Test It!

1. **Send a file** to your LINE or LINE WORKS group
2. **Check the terminal** - you should see:
   ```
   ✓ LINE signature verified
   📎 File detected
   ✓ File downloaded
   💾 Saved locally
   ☁️ Uploaded to Drive
   📧 Email sent
   ```
3. **Check your email** for the notification
4. **Check Google Drive** for the uploaded file
5. **Check `downloads/temp/`** for the local copy

## 📁 Project Structure

```
typescript-server/
├── src/
│   ├── server.ts                 # Main Express server
│   ├── services/
│   │   ├── LineClient.ts         # LINE Messenger API
│   │   ├── LineWorksClient.ts    # LINE WORKS API  
│   │   ├── DriveService.ts       # Google Drive uploads
│   │   ├── GmailService.ts       # Email notifications
│   │   └── RoutingService.ts     # Google Sheets lookup
├── .env                          # Your credentials
├── package.json
└── README.md
```

## 🔧 Troubleshooting

### ngrok URL changed?
Every time you restart ngrok, you get a new URL. Update your webhook URLs in LINE/LINE WORKS Developer Console.

### File not downloading?
Check that your credentials are correct in `.env` file.

### Email not sending?
1. Make sure Gmail API is enabled
2. Check that `credentials/token.json` has Gmail scope
3. Verify admin email is correct in Google Sheet

### Drive upload failing?
1. Check that the Drive Folder ID exists
2. Make sure the Service Account has access to the folder
3. Verify `credentials/oauth-credentials.json` is valid

## 📝 Notes

- **ngrok free tier** gives you a new URL each restart
- **Files are saved** in `downloads/temp/` before upload
- **Routing rules** are in your Google Spreadsheet
- **Both LINE and LINE WORKS** work simultaneously

## 🎯 Features


✅ LINE WORKS webhook  
✅ File download (images, videos, audio, files)  
✅ Local storage (downloads/temp/)  
✅ Google Drive upload  
✅ Gmail notifications  
✅ Google Sheets routing  
✅ Signature verification  

## 🔗 Links

- [LINE Developers](https://developers.line.biz/)
- [LINE WORKS Developers](https://developers.worksmobile.com/)
- [ngrok Download](https://ngrok.com/download)
- [Google Cloud Console](https://console.cloud.google.com/)
