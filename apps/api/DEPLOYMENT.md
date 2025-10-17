# 🚀 ICD API Deployment Guide

Complete guide for deploying the ICD-10-CM Diagnosis Assistant API to production and development environments.

## 📋 Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher  
- **PM2**: Process manager (auto-installed by deploy script)
- **PostgreSQL**: Supabase database access
- **OpenAI API Key**: For AI-powered embeddings

## 🔧 Initial Setup

### 1. Clone and Navigate

```bash
cd /root/auto-icd/apps/api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

```bash
# Copy the example environment file
cp env.example .env

# Edit the .env file with your credentials
nano .env
```

**Required Environment Variables:**

```env
DATABASE_URL=postgresql://postgres.xxxxx:password@aws-1-us-east-2.pooler.supabase.com:5432/postgres
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
PORT=3000
NODE_ENV=production
LOG_LEVEL=info
MAX_SUGGESTIONS=8
```

### 4. Make Deploy Script Executable

```bash
chmod +x deploy.sh
```

## 🌐 Deployment Methods

### Method 1: Using Deploy Script (Recommended)

The deploy script handles everything automatically:

```bash
# Deploy to production
./deploy.sh prod

# Deploy to development
./deploy.sh dev

# Check current status
./deploy.sh check
```

### Method 2: Using NPM Scripts

```bash
# Production deployment
npm run deploy:prod

# Development deployment
npm run deploy:dev

# Check PM2 status
npm run pm2:status

# View logs
npm run pm2:logs

# Restart API
npm run pm2:restart

# Stop API
npm run pm2:stop
```

### Method 3: Manual PM2 Commands

```bash
# Start in production
pm2 start ecosystem.config.js --env production
pm2 save

# Start in development
pm2 start ecosystem.config.js --env development
pm2 save

# Setup startup script
pm2 startup systemd
pm2 save
```

## ✅ Verification

### 1. Check API Health

```bash
# Local check
curl http://localhost:3000/api/health

# Production domain check
curl https://aicd.claimkit.ai/api/health

# Check database connection specifically
curl http://localhost:3000/api/health | jq '.database'
```

Expected output:
```json
{
  "status": "healthy",
  "database": {
    "connected": true,
    "status": "ok"
  }
}
```

### 2. Test Search Functionality

```bash
# Test ICD search
curl "http://localhost:3000/api/suggest?q=diabetes"

# Test CPT search
curl "http://localhost:3000/api/cpt/suggest?q=blood"

# Check embedding statistics
curl http://localhost:3000/api/stats/embeddings
```

### 3. Check PM2 Status

```bash
pm2 list
pm2 logs icd-api --lines 50
pm2 monit
```

## 🔄 Common Operations

### Restart After Code Changes

```bash
cd /root/auto-icd/apps/api
pm2 restart icd-api
```

### View Real-time Logs

```bash
pm2 logs icd-api
```

### Stop the API

```bash
pm2 stop icd-api
```

### Delete and Redeploy

```bash
pm2 delete icd-api
./deploy.sh prod
```

## 🐛 Troubleshooting

### Issue: Empty Search Results

**Symptoms:** API returns `{"items":[], "count": 0}`

**Solution:**

```bash
# 1. Check if .env file exists and is loaded
cat .env | grep DATABASE_URL

# 2. Restart with explicit environment loading
cd /root/auto-icd/apps/api
pm2 delete icd-api
./deploy.sh prod

# 3. Verify database connection
curl http://localhost:3000/api/health | jq '.database'
```

### Issue: Database Connection Refused

**Symptoms:** `ECONNREFUSED ::1:5432`

**Solution:**

```bash
# 1. Verify DATABASE_URL is set correctly
echo $DATABASE_URL

# 2. Check .env file
cat .env | grep DATABASE_URL

# 3. Ensure PM2 loads the .env file
pm2 delete icd-api
pm2 start ecosystem.config.js --env production
pm2 save
```

### Issue: Port Already in Use

**Symptoms:** `EADDRINUSE: address already in use 0.0.0.0:3000`

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process (replace PID)
kill -9 <PID>

# Or stop all PM2 processes
pm2 stop all
pm2 delete all

# Redeploy
./deploy.sh prod
```

### Issue: PM2 Process Keeps Restarting

**Check logs for errors:**

```bash
pm2 logs icd-api --err --lines 50
```

**Common fixes:**

```bash
# 1. Check if .env exists
ls -la .env

# 2. Verify node_modules are installed
npm install

# 3. Test if server starts manually
node src/server.js

# 4. Redeploy with verbose logging
LOG_LEVEL=debug ./deploy.sh prod
```

## 📊 Monitoring

### Check API Performance

```bash
# View PM2 monitoring dashboard
pm2 monit

# Check memory usage
pm2 show icd-api

# View CPU and memory stats
pm2 list
```

### Log Files

PM2 logs are stored in:
- **Output logs**: `~/.pm2/logs/icd-api-out.log`
- **Error logs**: `~/.pm2/logs/icd-api-error.log`
- **Custom logs**: `./logs/` (if configured)

```bash
# View all logs
pm2 logs icd-api

# View only errors
pm2 logs icd-api --err

# Clear logs
pm2 flush
```

## 🔐 Security Checklist

- ✅ Never commit `.env` file to git
- ✅ Use strong passwords for database
- ✅ Rotate API keys regularly
- ✅ Use HTTPS in production (handled by nginx/proxy)
- ✅ Set appropriate CORS origins
- ✅ Keep dependencies updated
- ✅ Use PM2 with limited privileges (non-root user)

## 🆘 Emergency Recovery

If something goes completely wrong:

```bash
# 1. Stop everything
pm2 stop all
pm2 delete all

# 2. Backup current .env
cp .env .env.backup

# 3. Fresh deployment
cd /root/auto-icd
git pull origin main  # or your branch
cd apps/api
npm install
./deploy.sh prod

# 4. If still broken, check logs
pm2 logs icd-api --lines 100
```

## 📞 Support

- **Logs location**: `~/.pm2/logs/`
- **Config file**: `ecosystem.config.js`
- **Environment**: `.env`
- **Main script**: `src/server.js`

For issues, check:
1. PM2 logs: `pm2 logs icd-api`
2. API health: `curl http://localhost:3000/api/health`
3. Database status: Check Supabase dashboard
4. System resources: `pm2 monit`

---

**Last Updated**: 2025-10-17

