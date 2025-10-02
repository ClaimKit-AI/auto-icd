# ICD Suggest & Specifier Tray

A medical diagnosis assistant with intelligent ICD code suggestions and specifier guidance, built for healthcare professionals.

## 🏥 Overview

This application provides real-time ICD (International Classification of Diseases) code suggestions as you type, similar to 3M's medical coding system. It features:

- **Real-time suggestions** with hybrid text + AI search
- **Apple-clean UI** with smooth animations
- **Ghost completion** for faster input
- **Specifier tray** showing ICD code modifiers
- **High performance** (≤120ms response time)

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- Supabase account (for database)
- Node.js 18+ (for local development)

### 1. Clone and Setup

```bash
git clone <your-repo-url>
cd Auto-ICD
```

### 2. Environment Configuration

```bash
# Copy environment template
cp env.example .env

# Edit .env with your Supabase credentials
# Get your DATABASE_URL from Supabase project settings
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the SQL schema in Supabase SQL editor:
   ```bash
   cat db/schema.sql
   ```
3. Copy and paste the entire schema into Supabase SQL editor
4. Execute the schema

### 4. Run with Docker

```bash
# Start the entire application
docker-compose up

# Or run in background
docker-compose up -d
```

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health

## 🛠️ Development

### Local Development (without Docker)

#### Backend API

```bash
cd apps/api
npm install
npm run dev
```

#### Frontend

```bash
cd apps/web
npm install
npm run dev
```

### Project Structure

```
icd-demo/
├── apps/
│   ├── web/                 # React frontend
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── hooks/       # Custom hooks
│   │   │   └── utils/       # Utility functions
│   │   └── package.json
│   └── api/                 # Node.js backend
│       ├── src/
│       │   ├── routes/      # API routes
│       │   └── database.js  # Database connection
│       └── package.json
├── db/
│   └── schema.sql           # Database schema
├── docker/
│   └── docker-compose.yml   # Docker configuration
└── README.md
```

## 🔌 API Endpoints

### GET /api/suggest?q=search_term
Returns ICD code suggestions for the given search term.

**Example:**
```bash
curl "http://localhost:3000/api/suggest?q=hyp"
```

**Response:**
```json
{
  "items": [
    {
      "code": "I10",
      "label": "Essential (primary) hypertension",
      "score": 2.1
    }
  ],
  "completion": "Essential (primary) hypertension",
  "query": "hyp",
  "latency_ms": 45
}
```

### GET /api/ranges/:code
Returns ICD specifiers for a given code.

**Example:**
```bash
curl "http://localhost:3000/api/ranges/S52.5"
```

**Response:**
```json
{
  "code": "S52.5",
  "root": "S52.5",
  "specifiers": {
    "laterality": [
      { "suffix": "1", "label": "Right" },
      { "suffix": "2", "label": "Left" }
    ],
    "encounter": [
      { "suffix": "A", "label": "Initial encounter" },
      { "suffix": "D", "label": "Subsequent encounter" },
      { "suffix": "S", "label": "Sequela" }
    ]
  }
}
```

### POST /api/normalize
Normalizes medical text to ICD codes.

**Example:**
```bash
curl -X POST "http://localhost:3000/api/normalize" \
  -H "Content-Type: application/json" \
  -d '{"text": "dm type 2 w/o comp"}'
```

## 🎯 Demo Examples

Try these examples in the application:

1. **Hypertension**: Type `hyp` → Shows I10 (Essential primary hypertension)
2. **Diabetes**: Type `dm type 2 w/o comp` → Shows E11.9 (Type 2 diabetes without complications)
3. **Fracture**: Type `radius frac` → Shows S52.5 family with laterality and encounter specifiers

## 🗄️ Database Schema

The application uses PostgreSQL with these key tables:

- **icd_codes**: Main ICD code catalog with embeddings
- **icd_specifiers**: Code modifiers (laterality, encounter, severity)
- **ui_events**: Optional analytics (no PHI)

Key extensions:
- `pg_trgm`: Fuzzy text search
- `unaccent`: Text normalization
- `vector`: AI embeddings (pgvector)

## 🚀 Deployment

### Digital Ocean Droplet

1. **Create Droplet** (Ubuntu 22.04, 1GB RAM minimum)
2. **Install Docker**:
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   sudo systemctl start docker
   sudo systemctl enable docker
   ```
3. **Deploy Application**:
   ```bash
   git clone <your-repo>
   cd Auto-ICD
   cp env.example .env
   # Edit .env with your database URL
   docker-compose up -d
   ```

### Environment Variables

```bash
# API Configuration
PORT=3000
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# AI Features (optional)
OPENAI_API_KEY=your_key_here
USE_VECTOR=true

# Performance
MAX_SUGGESTIONS=8
DEBOUNCE_MS=80
```

## 🧪 Testing

### Manual Testing

1. **Search Accuracy**: Test with medical terms and abbreviations
2. **Performance**: Verify response times are under 120ms
3. **Keyboard Navigation**: Test arrow keys, Enter, Tab, Escape
4. **Specifier Tray**: Verify specifiers load for appropriate codes

### Health Checks

- **API Health**: `GET /api/health`
- **Detailed Health**: `GET /api/health/detailed`
- **Readiness**: `GET /api/health/ready`
- **Liveness**: `GET /api/health/live`

## 🔧 Configuration

### Performance Tuning

- **Cache Size**: Adjust `CACHE_SIZE` in .env
- **Max Suggestions**: Modify `MAX_SUGGESTIONS`
- **Debounce**: Tune `DEBOUNCE_MS` for responsiveness

### AI Features

- **Vector Search**: Enable/disable with `USE_VECTOR`
- **Embedding Model**: Configure `EMBEDDING_MODEL`
- **OpenAI Key**: Add for AI-powered suggestions

## 📊 Monitoring

The application includes built-in monitoring:

- **Performance Logging**: Slow query detection
- **Error Tracking**: Comprehensive error handling
- **Health Endpoints**: For load balancers and monitoring
- **Analytics**: Optional UI event tracking (no PHI)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:

1. Check the health endpoints
2. Review the logs: `docker-compose logs`
3. Verify database connection
4. Check environment variables

## 🎬 Demo Script

1. Open http://localhost:5173
2. Type "hyp" → I10 appears → Tab completes
3. Type "dm type 2 w/o comp" → E11.9 → tray shows specifiers
4. Type "radius frac" → S52.5 family → tray shows laterality and encounter
5. Show performance logs and latency metrics

---

**Built with ❤️ for healthcare professionals**

