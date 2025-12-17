# Deployment Guide

## Your app is ready to deploy! 🚀

The frontend and backend are already integrated - the Node.js server serves the frontend from the `public` folder.

---

## Option 1: Railway (Recommended - Free & Easy)

### Steps:
1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway:**
   ```bash
   railway login
   ```

3. **Initialize project:**
   ```bash
   cd /Users/rahul/Desktop/FREELANCING/LINE/typescript-server
   railway init
   ```

4. **Add environment variables:**
   ```bash
   railway variables set LINE_CHANNEL_SECRET=your_value
   railway variables set LINEWORKS_CHANNEL_SECRET=your_value
   railway variables set LINEWORKS_CHANNEL_ID=your_value
   railway variables set LINEWORKS_BOT_SECRET=your_value
   railway variables set LINEWORKS_API_URL=your_value
   # Add all your other .env variables
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Get your URL:**
   ```bash
   railway domain
   ```

---

## Option 2: Render (Free Tier)

### Steps:
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment Variables:** Add all from `.env`
5. Click "Create Web Service"

---

## Option 3: Heroku

### Steps:
1. **Install Heroku CLI:**
   ```bash
   brew tap heroku/brew && brew install heroku
   ```

2. **Login:**
   ```bash
   heroku login
   ```

3. **Create app:**
   ```bash
   cd /Users/rahul/Desktop/FREELANCING/LINE/typescript-server
   heroku create your-app-name
   ```

4. **Set environment variables:**
   ```bash
   heroku config:set LINE_CHANNEL_SECRET=your_value
   heroku config:set LINEWORKS_CHANNEL_SECRET=your_value
   # Add all other variables
   ```

5. **Deploy:**
   ```bash
   git push heroku main
   ```

---

## Option 4: VPS (Digital Ocean, AWS, etc.)

### Steps:
1. **SSH into your server:**
   ```bash
   ssh user@your-server-ip
   ```

2. **Install Node.js:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Install PM2:**
   ```bash
   sudo npm install -g pm2
   ```

4. **Upload your code:**
   ```bash
   # On your local machine
   rsync -avz --exclude 'node_modules' ./ user@your-server-ip:/home/user/app/
   ```

5. **On server, install dependencies:**
   ```bash
   cd /home/user/app
   npm install
   npm run build
   ```

6. **Create .env file on server:**
   ```bash
   nano .env
   # Paste all your environment variables
   ```

7. **Start with PM2:**
   ```bash
   pm2 start dist/server.js --name "line-webhook"
   pm2 save
   pm2 startup
   ```

8. **Setup Nginx (optional but recommended):**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/default
   ```
   
   Add this configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo nginx -t
   sudo systemctl restart nginx
   ```

---

## Important: Environment Variables

Make sure to set these on your hosting platform:

```env
PORT=3000
LINEWORKS_CHANNEL_SECRET=xxx
LINEWORKS_CHANNEL_ID=xxx
LINEWORKS_BOT_SECRET=xxx
LINEWORKS_API_URL=https://www.worksapis.com/v1.0
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx
GOOGLE_PRIVATE_KEY=xxx (paste the entire key)
GMAIL_USER=xxx
```

---

## After Deployment:

1. **Update LINE WORKS Webhook URL:**
   - Go to LINE WORKS Developer Console
   - Update webhook URL to: `https://your-app-url.com/webhooks/lineworks`

2. **Test the deployment:**
   - Visit: `https://your-app-url.com`
   - Click START MONITORING
   - Send a file in LINE WORKS group
   - Check logs in the web interface

---

## Quick Deploy with Railway (Fastest):

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Deploy in one command
cd /Users/rahul/Desktop/FREELANCING/LINE/typescript-server
railway login
railway init
railway up

# 3. Add environment variables via web dashboard
# Visit railway.app → Your Project → Variables

# 4. Get your URL
railway domain
```

That's it! Your app is now live! 🎉
