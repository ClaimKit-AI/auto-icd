# 🚀 Auto-ICD V1 - Deployment Guide

## 📋 **Pre-Deployment Checklist**

Before pushing to GitHub, ensure:
- [ ] All environment variables are in `.env` (not committed)
- [ ] Database credentials are secure
- [ ] OpenAI API key is not hardcoded
- [ ] Large files excluded (.xlsx, .pdf, images)
- [ ] Test files cleaned up
- [ ] README.md updated

## 🔐 **GitHub Setup**

### **Step 1: Install Git** (if not installed)
Download from: https://git-scm.com/downloads

### **Step 2: Initialize Repository**
```bash
git init
git add .
git commit -m "Initial commit - Auto-ICD V1 with AI RAG system"
```

### **Step 3: Configure Git Credentials**
```bash
git config user.name "claimkit-ai"
git config user.email "your-email@example.com"
```

### **Step 4: Add Remote Repository**
```bash
git remote add origin https://github.com/claimkit-ai/auto-icd.git
```

### **Step 5: Push to GitHub**
```bash
# For first push
git branch -M main
git push -u origin main

# For subsequent pushes
git push
```

### **Authentication**
When prompted:
- Username: `claimkit-ai`
- Password: `gaddouhaA1/22` (use Personal Access Token instead for security)

## 🔒 **Security Best Practices**

### **Environment Variables**
Never commit these files:
- `.env`
- Any file containing API keys
- Database connection strings
- Passwords

### **Use GitHub Secrets** (for CI/CD)
In GitHub repo settings → Secrets:
- `DATABASE_URL`
- `OPENAI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

## 📦 **What Gets Pushed**

### **Included:**
✅ Source code (`apps/api/src`, `apps/web/src`)
✅ Configuration files (`package.json`, `tailwind.config.js`)
✅ Database schemas (`db/*.sql`)
✅ Documentation (`*.md`)
✅ Docker files
✅ Example environment file (`.env.example`)

### **Excluded (.gitignore):**
❌ `node_modules/`
❌ `.env` files
❌ Excel data files (`.xlsx`)
❌ PDF files
❌ Personal images
❌ Test/debug scripts
❌ Build outputs

## 🌐 **Production Deployment**

### **Option 1: Docker Deployment**
```bash
docker-compose up -d
```

### **Option 2: Manual Deployment**

**Backend (Node.js):**
```bash
cd apps/api
npm install --production
NODE_ENV=production npm start
```

**Frontend (Static Build):**
```bash
cd apps/web
npm install
npm run build
# Serve the dist/ folder with nginx
```

### **Option 3: Cloud Platforms**

**Vercel (Frontend):**
- Connect GitHub repo
- Set root directory: `apps/web`
- Build command: `npm run build`
- Output directory: `dist`

**Railway/Render (Backend):**
- Connect GitHub repo
- Set root directory: `apps/api`
- Start command: `npm start`
- Add environment variables

## 🔄 **Continuous Integration**

### **GitHub Actions Example**
Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Auto-ICD
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd apps/api && npm install
      - run: cd apps/web && npm install && npm run build
```

## 📊 **Database Migration**

### **Initial Setup**
```bash
# Run schema files in order:
1. db/schema.sql          # ICD tables
2. db/cpt_schema.sql      # CPT tables
3. node setup_rag_system.js   # Vector search functions
```

### **Data Loading**
```bash
# Load ICD codes (30 minutes)
node apps/api/load_full_icd_dataset.js

# Load CPT codes (5 minutes)
node apps/api/load_cpt_optimized.js

# Generate embeddings (optional, costs ~$1.50)
node apps/api/generate_all_embeddings.js
node apps/api/test_cpt_embeddings.js
```

## 🧪 **Testing**

### **API Health Check**
```bash
curl http://localhost:3000/api/health
```

### **ICD Search**
```bash
curl "http://localhost:3000/api/suggest?q=diabetes"
```

### **CPT Search**
```bash
curl "http://localhost:3000/api/cpt/suggest?q=blood"
```

### **Medical Linking**
```bash
curl "http://localhost:3000/api/icd/E11.21/cpt"
```

## 📈 **Monitoring**

### **Key Metrics**
- API response times (logged)
- Database connection pool usage
- OpenAI API rate limits
- Search accuracy and user satisfaction

### **Logs**
- Backend: Check Fastify logs
- Database: Monitor Supabase dashboard
- Frontend: Browser console

## 🐛 **Troubleshooting**

### **Common Issues**

**1. Database Connection Fails**
- Check `DATABASE_URL` in `.env`
- Verify Supabase credentials
- Test connection: `node test-db-connection.js`

**2. OpenAI API Errors**
- Verify `OPENAI_API_KEY`
- Check rate limits
- Monitor usage at platform.openai.com

**3. Frontend Not Loading**
- Clear cache: `Remove-Item -Recurse -Force node_modules/.cache`
- Restart dev server
- Check browser console for errors

**4. Search Returns No Results**
- Check if embeddings are generated
- Verify database has data
- Try traditional search (should always work)

## 📞 **Support**

- **Issues**: Open GitHub issue
- **Discussions**: Use GitHub discussions
- **Email**: support@claimkit.ai

## 🎯 **Roadmap**

### **v1.1 (Planned)**
- [ ] Complete embedding generation (all 75K codes)
- [ ] Advanced medical linking with GPT-4
- [ ] User feedback and learning system
- [ ] Export functionality (CSV, PDF)

### **v2.0 (Future)**
- [ ] Multi-language support
- [ ] Voice search
- [ ] Mobile app
- [ ] Integration with EHR systems

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintainer**: ClaimKit AI Team


