# CYRUS AI System - Production Deployment

## Quick Deploy Options

### Option 1: Railway (Recommended)
1. Fork/clone this repository to GitHub
2. Connect to Railway: https://railway.app
3. Deploy from your GitHub repository
4. Set environment variables in Railway dashboard
5. Your app will be live at the generated Railway URL

### Option 2: Vercel
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in this directory
3. Configure environment variables
4. Deploy

### Option 3: Manual Server
1. Upload this package to your server
2. Configure environment variables
3. Run `npm start`

## Environment Variables Required

Copy `.env.production` to `.env` and fill in:

- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Long random string for sessions
- `USE_LOCAL_LLM=true`: Keep local AI enabled

## Database Setup

You'll need a PostgreSQL database. Railway provides one automatically.

## Post-Deployment

After deployment, your CYRUS system will be available at the generated URL.
