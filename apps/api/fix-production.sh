#!/bin/bash
# Quick Fix Script for Production Database Connection Issue
# Run this on your DigitalOcean server to fix empty search results
#
# Usage: ./fix-production.sh

set -e

echo "🔧 ICD API Production Fix Script"
echo "================================="
echo ""

# Navigate to API directory
cd /root/auto-icd/apps/api

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Looking for backup..."
    
    if [ -f ~/backup-api.env ]; then
        echo "✅ Found backup-api.env, copying..."
        cp ~/backup-api.env .env
        echo "✅ .env file restored"
    else
        echo "❌ No backup found. Please create .env file manually."
        exit 1
    fi
fi

echo "✅ .env file exists"
echo ""

# Verify environment variables
echo "🔍 Checking environment variables..."
source .env

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env!"
    exit 1
fi

echo "✅ DATABASE_URL is set"
echo ""

# Make deploy script executable
chmod +x deploy.sh

# Stop all existing PM2 processes
echo "🛑 Stopping existing processes..."
pm2 stop all || true
pm2 delete all || true
echo "✅ Cleaned up old processes"
echo ""

# Deploy using the deployment script
echo "🚀 Starting deployment..."
./deploy.sh prod

echo ""
echo "================================="
echo "✅ Fix Complete!"
echo "================================="
echo ""
echo "🧪 Testing the API..."
sleep 3

# Test the API
echo ""
echo "1️⃣  Health Check:"
if command -v jq &> /dev/null; then
    curl -s http://localhost:3000/api/health | jq '.database'
else
    curl -s http://localhost:3000/api/health | grep -o '"database":{[^}]*}'
fi

echo ""
echo "2️⃣  Search Test:"
if command -v jq &> /dev/null; then
    SEARCH_RESULT=$(curl -s "http://localhost:3000/api/suggest?q=diabetes" | jq '.items | length')
    echo "Found $SEARCH_RESULT results"
else
    curl -s "http://localhost:3000/api/suggest?q=diabetes" | grep -o '"items":\[[^]]*\]' | head -c 100
    echo "..."
fi

echo ""
echo "3️⃣  Domain Test:"
if command -v jq &> /dev/null; then
    curl -s "https://aicd.claimkit.ai/api/health" | jq '.database.connected'
else
    curl -s "https://aicd.claimkit.ai/api/health" | grep -o '"connected":[^,]*'
fi

echo ""
echo "================================="
echo "✅ All done! Your API should now be working."
echo ""
echo "📊 View logs: npm run pm2:logs"
echo "🔄 Restart: npm run pm2:restart"
echo "📈 Monitor: pm2 monit"
echo "================================="

