# 📤 How to Push Auto-ICD to GitHub

## 🔧 **Option 1: Install Git and Push (Recommended)**

### **Step 1: Install Git**
1. Download Git for Windows: https://git-scm.com/download/win
2. Run installer with default settings
3. Restart your terminal

### **Step 2: Push to GitHub**
Open PowerShell in the project folder and run:

```powershell
# Initialize git repository
git init

# Add all files (respecting .gitignore)
git add .

# Commit changes
git commit -m "Auto-ICD V1 - AI-powered medical coding system with ICD-10-CM and CPT"

# Add remote repository
git remote add origin https://github.com/claimkit-ai/auto-icd.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### **Step 3: Authenticate**
When prompted:
- **Username**: `claimkit-ai`
- **Password**: Use a **Personal Access Token** instead of password:
  1. Go to GitHub.com → Settings → Developer settings → Personal access tokens
  2. Generate new token (classic)
  3. Select scopes: `repo` (full control)
  4. Copy the token and use it as password

## 🌐 **Option 2: Use GitHub Desktop (Easiest)**

### **Step 1: Install GitHub Desktop**
Download from: https://desktop.github.com

### **Step 2: Add Repository**
1. Open GitHub Desktop
2. File → Add Local Repository
3. Choose folder: `C:\Users\suppo\OneDrive\Desktop\Auto-ICD`
4. Click "create a repository" if prompted

### **Step 3: Publish to GitHub**
1. Click "Publish repository"
2. Name: `auto-icd`
3. Account: `claimkit-ai`
4. Click "Publish repository"

## 📁 **Option 3: Manual Upload (Not Recommended)**

1. Go to https://github.com/new
2. Repository name: `auto-icd`
3. Create repository
4. Use "Upload files" button
5. Drag and drop your project folder
6. Commit changes

**⚠️ WARNING**: Make sure to:
- DELETE `.env` file before uploading
- DELETE Excel files (too large)
- DELETE personal images

## ✅ **Before Pushing - Checklist**

Make sure these are NOT in your repository:
- [ ] `.env` file (contains secrets)
- [ ] `node_modules/` (too large)
- [ ] Excel files (`*.xlsx`)
- [ ] Personal PDFs
- [ ] OpenAI API key
- [ ] Database password

These are automatically excluded by `.gitignore` if using Git properly.

## 🔐 **Secure Your Repository**

### **After Pushing:**
1. Check repository settings
2. Make it **Private** if containing sensitive data
3. Add collaborators if needed
4. Enable branch protection
5. Set up GitHub Secrets for CI/CD

### **GitHub Secrets (for production):**
Go to: Settings → Secrets and variables → Actions

Add:
- `DATABASE_URL` = your Supabase connection
- `OPENAI_API_KEY` = your OpenAI key

## 📝 **Commit Message Template**

```
Auto-ICD V1 - AI-Powered Medical Coding System

Features:
- 67,985 ICD-10-CM codes with AI semantic search
- 7,902 CPT procedure codes with embeddings
- AI-powered ICD-CPT medical linking
- Beautiful glassy UI with hospital background
- Hybrid search (vector + traditional)
- Real-time code building with specifiers
- Production-ready with Docker support

Tech Stack: React + Node.js + PostgreSQL + OpenAI
```

## 🎯 **Next Steps After Push**

1. Verify repository is accessible
2. Set up GitHub Actions (optional)
3. Add collaborators
4. Create releases/tags for versions
5. Set up project board for tracking

---

**Ready to push your amazing medical coding system to GitHub!** 🚀

