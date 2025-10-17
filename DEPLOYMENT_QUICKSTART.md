# 🚀 Quick Deployment Fix for DigitalOcean

## Current Issue

Your API is running but returning empty search results because **PM2 isn't loading the `.env` file** with your database credentials.

## ⚡ Quick Fix (2 minutes)

SSH into your DigitalOcean server and run:

```bash
cd /root/auto-icd/apps/api
chmod +x fix-production.sh
./fix-production.sh
```

This will:
1. ✅ Restore your `.env` file from backup
2. ✅ Stop old PM2 processes
3. ✅ Deploy with proper environment loading
4. ✅ Test the API automatically

## 📋 What Changed

I've added proper configuration files to your codebase:

### New Files Added:

1. **`apps/api/ecosystem.config.js`** - PM2 configuration with proper .env loading
2. **`apps/api/deploy.sh`** - Automated deployment script
3. **`apps/api/fix-production.sh`** - Quick fix for current issue
4. **`apps/api/DEPLOYMENT.md`** - Complete deployment guide
5. **`apps/api/env.example`** - Environment variable template
6. **Updated `package.json`** - Added deployment scripts

### New Commands Available:

```bash
# Quick deployment
./deploy.sh prod          # Deploy to production
./deploy.sh dev           # Deploy to development
./deploy.sh check         # Check current status

# Using NPM scripts
npm run deploy:prod       # Deploy to production
npm run pm2:logs          # View logs
npm run pm2:restart       # Restart API
npm run pm2:status        # Check status
```

## 🎯 For Future Deployments

After you commit these changes, deploying will be as simple as:

```bash
# On your DigitalOcean server
cd /root/auto-icd
git pull
cd apps/api
./deploy.sh prod
```

## ✅ Verification

After running the fix script, verify everything works:

```bash
# Check database connection
curl http://localhost:3000/api/health | jq '.database'

# Should return: {"connected": true, "status": "ok"}

# Test search
curl "http://localhost:3000/api/suggest?q=diabetes" | jq '.items | length'

# Should return a number greater than 0

# Test on your domain
curl "https://aicd.claimkit.ai/api/suggest?q=fracture"

# Should return ICD codes in your browser
```

## 🐛 If It Still Doesn't Work

Run diagnostics:

```bash
cd /root/auto-icd/apps/api

# Check if .env exists
cat .env | grep DATABASE_URL

# Check PM2 logs
pm2 logs icd-api --lines 50

# Check if the correct process is running
pm2 list

# Manual restart
pm2 stop all
pm2 delete all
./deploy.sh prod
```

## 📞 What to Share if You Need Help

If you still have issues, run this and share the output:

```bash
cd /root/auto-icd/apps/api

echo "=== PM2 Status ==="
pm2 list

echo -e "\n=== Environment Check ==="
ls -la .env
source .env && echo "DATABASE_URL: ${DATABASE_URL:0:50}..."

echo -e "\n=== API Health ==="
curl -s http://localhost:3000/api/health | jq '.'

echo -e "\n=== Recent Logs ==="
pm2 logs icd-api --lines 20 --nostream
```

---

## 🎓 Understanding the Fix

**The Problem:**
- PM2 was starting your API without loading the `.env` file
- The API tried to connect to local PostgreSQL instead of Supabase
- This caused: `ECONNREFUSED ::1:5432` and empty search results

**The Solution:**
- `ecosystem.config.js` tells PM2 to load `.env` automatically
- The deploy script ensures environment variables are properly set
- PM2 now passes `DATABASE_URL` to your Node.js application

**Why It Works Now:**
```javascript
// ecosystem.config.js loads .env first
require('dotenv').config();

// Then passes variables to your app
env_production: {
  DATABASE_URL: process.env.DATABASE_URL,  // ← This is the key!
  OPENAI_API_KEY: process.env.OPENAI_API_KEY
}
```

---

**Next Steps:**
1. Run `./fix-production.sh` on your server
2. Test in your browser at https://aicd.claimkit.ai
3. Search should now return results! 🎉
4. Commit these new files to your repo for future use

