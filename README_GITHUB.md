# 🏥 Auto-ICD - AI-Powered Medical Coding Assistant

> **Version 1.0** - Enterprise-grade ICD-10-CM and CPT code search with AI-powered semantic search and medical linking

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Status](https://img.shields.io/badge/status-production-green.svg)

## 🌟 **Features**

### **AI-Powered Search**
- 🤖 **Semantic Search** - Understands medical terminology beyond exact text matches
- 🔍 **Hybrid Search** - Combines traditional text search with vector similarity
- ⚡ **Fast Results** - Sub-100ms response times with intelligent caching
- 🧠 **Context-Aware** - Uses OpenAI embeddings for medical context understanding

### **Medical Code Systems**
- 📋 **ICD-10-CM** - 67,985 diagnosis codes (Omani dataset)
- 🏥 **CPT** - 7,902 procedure codes with AI embeddings
- 🔗 **Medical Linking** - AI-suggested CPT procedures for ICD diagnoses
- ✨ **Specifier Builder** - Interactive ICD code construction with proper formatting

### **Premium UI/UX**
- 💎 **Glassy Apple Design** - iOS-inspired frosted glass interface
- 🏥 **Medical Background** - Professional hospital imagery
- 🎭 **Smooth Animations** - Floating medical icons and typing effects
- 📱 **Responsive** - Works on all devices

## 🚀 **Quick Start**

### **Prerequisites**
```bash
Node.js 18+ 
PostgreSQL with pgvector extension
OpenAI API key
```

### **Installation**

1. **Clone the repository**
```bash
git clone https://github.com/claimkit-ai/auto-icd.git
cd auto-icd
```

2. **Install dependencies**
```bash
# Backend
cd apps/api
npm install

# Frontend
cd ../web
npm install
```

3. **Configure environment**
```bash
# Copy example env file
cp apps/api/.env.example apps/api/.env

# Edit .env with your credentials:
# - DATABASE_URL (Supabase PostgreSQL)
# - OPENAI_API_KEY
```

4. **Setup database**
```bash
cd apps/api
node setup_rag_system.js
node setup_cpt_schema.js
```

5. **Load data** (optional - takes time)
```bash
# Load ICD codes
node load_full_icd_dataset.js

# Load CPT codes
node load_cpt_optimized.js

# Generate embeddings (or use pre-embedded data)
node generate_all_embeddings.js
node test_cpt_embeddings.js
```

6. **Start servers**
```bash
# Backend (terminal 1)
cd apps/api
npm start

# Frontend (terminal 2)
cd apps/web
npm start
```

7. **Open browser**
```
http://localhost:5173
```

## 📊 **Architecture**

### **Tech Stack**
```
Frontend:  React + Vite + Tailwind CSS
Backend:   Node.js + Fastify
Database:  PostgreSQL (Supabase) + pgvector
AI:        OpenAI Embeddings (text-embedding-3-small)
```

### **System Components**
```
┌─────────────────────────────────────────────┐
│          React Frontend (Port 5173)         │
│  Glassy UI • Real-time Search • Animations  │
└──────────────────┬──────────────────────────┘
                   │ REST API
┌──────────────────▼──────────────────────────┐
│        Fastify Backend (Port 3000)          │
│  Hybrid Search • AI RAG • Medical Linking   │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼────┐  ┌──────▼─────┐  ┌────▼─────┐
│  ICD   │  │    CPT     │  │  OpenAI  │
│ Codes  │  │   Codes    │  │Embeddings│
│67,985  │  │   7,902    │  │   API    │
└────────┘  └────────────┘  └──────────┘
```

## 🗂️ **Database Schema**

### **ICD Codes Table**
- Full diagnosis information
- Vector embeddings (1536 dimensions)
- Chapter/block/category classification
- Synonyms and normalized titles

### **CPT Codes Table**
- Procedure descriptions (short, medium, full)
- Vector embeddings for semantic search
- Chapter and subchapter categorization
- Active status and date tracking

### **ICD-CPT Links Table**
- Medical relationship mapping
- AI confidence scores
- Clinical context explanations

## 🎨 **UI Components**

- **MainSearch** - Glassy search input with real-time ICD code display
- **SuggestionDropdown** - AI-powered search results
- **SpecifierTray** - Interactive specifier selection
- **DiagnosisDetails** - Comprehensive diagnosis information
- **CPTSuggestions** - AI-recommended procedures for selected diagnosis

## 🤖 **AI Features**

### **Semantic Search**
- Finds codes by meaning, not just text
- Example: "heart attack" → finds myocardial infarction codes
- Similarity scoring (0-1 confidence)

### **Medical Linking**
- Automatically suggests appropriate CPT procedures for ICD diagnoses
- Example: E11.21 (Diabetes with nephropathy) → Blood tests, monitoring procedures
- Context-aware recommendations

### **Hybrid Search**
- Combines vector similarity with traditional text search
- Weighted scoring for best results
- Fallback to traditional search if AI unavailable

## 📝 **API Endpoints**

### **ICD Endpoints**
```
GET  /api/suggest?q={query}          # Search ICD codes
GET  /api/specifiers/:code           # Get specifiers for code
GET  /api/icd/:code/cpt             # Get CPT for ICD diagnosis
GET  /api/health                     # Health check
```

### **CPT Endpoints**
```
GET  /api/cpt/suggest?q={query}      # Search CPT procedures
```

## 💰 **Cost & Performance**

### **AI Embedding Costs**
- ICD: 100 embedded = $0.002
- CPT: 893 embedded = $0.018
- Total: ~$0.02 (for current embeddings)
- Full dataset: ~$1.50 (all codes)

### **Search Performance**
- Traditional search: <50ms
- Vector search: 50-100ms
- Hybrid search: 80-150ms
- Cached results: <10ms

## 🔒 **Security**

- CORS enabled for frontend
- Helmet security headers
- SSL/TLS for database connections
- No PHI (Personal Health Information) stored
- API key management via environment variables

## 📦 **Deployment**

### **Docker Support**
```bash
docker-compose up
```

### **Environment Variables**
```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
PORT=3000
NODE_ENV=production
```

## 🤝 **Contributing**

This is a production medical coding system. Contributions should:
- Follow medical coding standards (ICD-10-CM, CPT)
- Maintain AI accuracy and medical correctness
- Include tests for new features
- Follow code style guidelines

## 📄 **License**

MIT License - See LICENSE file

## 🏆 **Credits**

- **Data Source**: Omani ICD-10-CM and CPT datasets
- **AI**: OpenAI embeddings
- **Database**: Supabase (PostgreSQL + pgvector)
- **Design**: Inspired by Apple's glassmorphism

## 📞 **Support**

For issues or questions, please open a GitHub issue.

---

**Built with ❤️ for healthcare professionals**

