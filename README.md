# 📁 PROJECT STRUCTURE OVERVIEW

**Clean and organized workspace structure for TikTok Live Scraper v2**

---

## 🗂️ **MAIN DIRECTORIES:**

```
📁 v2-tiktok-scraper-live/
├── 📁 docs/                          # All documentation
│   ├── 📁 analysis/                  # Performance & rate limit analysis
│   ├── 📁 guides/                    # Setup & deployment guides
│   ├── 📁 concepts/                  # Future features & smart monitoring
│   └── 📄 *.md                       # General documentation
├── 📁 routes/                        # API route handlers
├── 📁 services/                      # Business logic services
├── 📁 tests/                         # All test files
├── 📁 data/                          # Data storage
│   ├── 📁 accounts/                  # Account lists (day/night shifts)
│   ├── 📁 backups/                   # Historical backups
│   ├── 📁 live-metadata/            # TikTok metadata samples
│   ├── 📄 live_data.csv            # Current live data (CSV)
│   └── 📄 live_data.json           # Current live data (JSON)
├── 📁 scripts/                       # Utility & setup scripts
└── 📁 node_modules/                  # Dependencies
```

---

## 🚀 **CORE FILES:**

### **Main Application:**
- `server.js` - Main server with all production features
- `frontend.html` - Web dashboard interface
- `supabase-client.js` - Database integration

### **Configuration:**
- `package.json` - Dependencies & scripts
- `railway.toml` - Railway deployment config
- `.env` - Environment variables (local)
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules

### **Development:**
- `Dockerfile` - Container configuration (if needed)
- `scraping.log` - Application logs

---

## 📋 **QUICK NAVIGATION:**

### **🔧 Need to Deploy?**
```bash
docs/guides/RAILWAY_DEPLOYMENT_CHECKLIST.md
docs/guides/SUPABASE_SETUP_GUIDE.md
```

### **📊 Performance Analysis?**
```bash
docs/analysis/RATE_LIMITING_OPTIMIZATION.md
docs/analysis/DUAL_DEPLOYMENT_ANALYSIS.md
```

### **🚀 Future Features?**
```bash
docs/concepts/SMART_MONITORING_CONCEPT.md
docs/concepts/PROFILE_BIO_SCRAPING_CONCEPT.md
```

### **🧪 Testing?**
```bash
tests/test_*.js
```

### **⚙️ Setup Scripts?**
```bash
scripts/supabase-schema.sql
scripts/get_tiktok_live_metadata.js
```

### **📂 Account Management?**
```bash
data/accounts/account.txt              # Main account list
data/accounts/account_day_shift.txt    # Day shift accounts
data/accounts/account_night_shift.txt  # Night shift accounts
```

---

## 📖 **DOCUMENTATION STRUCTURE:**

### **Analysis Reports (`docs/analysis/`):**
- `RATE_LIMITING_OPTIMIZATION.md` - Rate limit analysis & optimization
- `DUAL_DEPLOYMENT_ANALYSIS.md` - 15 accounts deployment strategy
- `RATE_LIMIT_DAILY_ANALYSIS.md` - Daily request analysis
- `DETAILED_15_ACCOUNTS_ANALYSIS.md` - Detailed rate limit scenarios

### **Setup Guides (`docs/guides/`):**
- `RAILWAY_DEPLOYMENT_CHECKLIST.md` - Complete deployment guide
- `DATA_PERSISTENCE_SOLUTION.md` - Supabase integration guide
- `SUPABASE_SETUP_GUIDE.md` - Database setup instructions

### **Future Concepts (`docs/concepts/`):**
- `SMART_MONITORING_CONCEPT.md` - AI-powered monitoring system
- `SMART_MONITORING_IMPLEMENTATION.md` - Technical implementation details
- `SMART_MONITORING_BUSINESS_CASE.md` - Business impact analysis
- `PROFILE_BIO_SCRAPING_CONCEPT.md` - Bio scraping & schedule extraction
- `ACCOUNT_DISCOVERY_ENGINE_CONCEPT.md` - Automated account discovery

### **General Documentation (`docs/`):**
- `FINAL_IMPLEMENTATION_REPORT.md` - Complete project summary
- `AUTOCHECKER_DOCUMENTATION.md` - Autochecker system docs
- `BUG_FIXES_DOCUMENTATION.md` - Bug fixes & solutions
- `SESSION_DETECTION_LOGIC.md` - Session detection implementation

---

## 🔄 **DEVELOPMENT WORKFLOW:**

### **1. Local Development:**
```bash
npm install                 # Install dependencies
npm run dev                # Start development server
npm test                   # Run test suite
```

### **2. Testing:**
```bash
node tests/test_api.js                    # Test API endpoints
node tests/test_autochecker.js           # Test autochecker logic
node tests/test_session_detection.js     # Test session detection
```

### **3. Database Setup:**
```bash
# Setup Supabase (first time)
node scripts/create-tables.js

# Migrate existing data
node scripts/migrate-to-supabase.js
```

### **4. Deployment:**
```bash
# Follow deployment checklist
docs/guides/RAILWAY_DEPLOYMENT_CHECKLIST.md
```

---

## ⚡ **QUICK COMMANDS:**

### **Start Application:**
```bash
npm start                   # Production mode
npm run dev                # Development mode (if available)
```

### **Data Management:**
```bash
# Download current data
curl http://localhost:3000/download-csv

# Check system status
curl http://localhost:3000/healthz

# View current live data
curl http://localhost:3000/api/live-data
```

### **Account Management:**
```bash
# Edit main account list
nano data/accounts/account.txt

# Edit day shift accounts (dual deployment)
nano data/accounts/account_day_shift.txt

# Edit night shift accounts (dual deployment) 
nano data/accounts/account_night_shift.txt
```

---

## 🎯 **CURRENT STATUS:**

✅ **Production Ready** - Fully deployed with:
- Railway hosting
- Supabase database integration
- Rate limiting optimization
- Auto-recovery system
- Data persistence across redeploys

✅ **Monitoring** - Currently monitoring 3 accounts safely within rate limits

🔄 **Next Steps** - Ready for:
- Dual deployment (15 accounts total)
- Smart monitoring system implementation
- Account discovery automation

---

**For detailed information about any component, check the relevant documentation in the `docs/` folder! 📖**
