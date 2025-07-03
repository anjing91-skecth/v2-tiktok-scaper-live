# 🚀 DUAL DEPLOYMENT SETUP GUIDE

**Purpose:** Deploy 2 separate Railway apps for day/night shift monitoring  
**Total Coverage:** 12 accounts (6 day + 6 night)  
**Rate Limit Status:** Safe for both deployments

---

## 📋 **DEPLOYMENT A: DAY SHIFT**

### **Repository Setup:**
```bash
# Clone and setup day shift version
git clone <your-repo> tiktok-scraper-day
cd tiktok-scraper-day

# Copy day shift accounts
cp account_day_shift.txt account.txt

# Environment variables for Railway
```

### **Railway Environment Variables (Day Shift):**
```env
NODE_ENV=production
PORT=3000

# Rate Limiting - Conservative for 6 accounts
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=5
RATE_LIMIT_REQUESTS_PER_HOUR=40
RATE_LIMIT_REQUEST_DELAY=2500

# Autochecker - 90 minutes to stay within limits
AUTO_CHECKER_INTERVAL=5400000
AUTO_CHECKER_ENABLED=true

# Session Detection
SESSION_DETECTION_ENABLED=true
SESSION_TIME_GAP_THRESHOLD=600000
SESSION_MAX_DURATION=43200000

# Logging
LOG_LEVEL=info
LOG_ENHANCED_RATE_LIMITING=true

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_CORS_ORIGIN=*

# Data Persistence
DATA_PERSISTENCE_ENABLED=true
CSV_EXPORT_ENABLED=true

# Supabase (Day Shift Database)
SUPABASE_URL=https://your-day-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-day-service-key
```

### **Day Shift Accounts:**
```
tiramisu_dance     # Active 7 AM - 3 PM
glow_babies1       # Active 8 AM - 4 PM  
firedance.fd       # Active 9 AM - 5 PM
sky_weeekly        # Active 10 AM - 6 PM
cocoberrygirls     # Active 6 AM - 2 PM
nova_deluna        # Active 11 AM - 7 PM
```

---

## 🌙 **DEPLOYMENT B: NIGHT SHIFT**

### **Repository Setup:**
```bash
# Clone and setup night shift version
git clone <your-repo> tiktok-scraper-night
cd tiktok-scraper-night

# Copy night shift accounts
cp account_night_shift.txt account.txt
```

### **Railway Environment Variables (Night Shift):**
```env
NODE_ENV=production
PORT=3000

# Rate Limiting - Conservative for 6 accounts
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=5
RATE_LIMIT_REQUESTS_PER_HOUR=40
RATE_LIMIT_REQUEST_DELAY=2500

# Autochecker - 90 minutes
AUTO_CHECKER_INTERVAL=5400000
AUTO_CHECKER_ENABLED=true

# Session Detection
SESSION_DETECTION_ENABLED=true
SESSION_TIME_GAP_THRESHOLD=600000
SESSION_MAX_DURATION=43200000

# Logging
LOG_LEVEL=info
LOG_ENHANCED_RATE_LIGHTING=true

# WebSocket
WEBSOCKET_ENABLED=true
WEBSOCKET_CORS_ORIGIN=*

# Data Persistence
DATA_PERSISTENCE_ENABLED=true
CSV_EXPORT_ENABLED=true

# Supabase (Night Shift Database)
SUPABASE_URL=https://your-night-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-night-service-key
```

### **Night Shift Accounts:**
```
soul_sisters1000   # Active 7 PM - 3 AM
fire_dance03       # Active 8 PM - 4 AM
1908_sky_light     # Active 9 PM - 5 AM
vortexspark_dance  # Active 6 PM - 2 AM
babyblue.001       # Active 10 PM - 6 AM
redbomb_dance      # Active 8 PM - 4 AM
```

---

## 📊 **RATE LIMIT ANALYSIS:**

### **Day Shift (6 accounts, 90 min interval):**
```
Checks per day: 6 × 16 = 96 requests
Daily limit: 120 requests
Safety margin: 24 requests (20% buffer)
Status: ✅ SAFE
```

### **Night Shift (6 accounts, 90 min interval):**
```
Checks per day: 6 × 16 = 96 requests
Daily limit: 120 requests  
Safety margin: 24 requests (20% buffer)
Status: ✅ SAFE
```

### **Combined Coverage:**
```
Total accounts monitored: 12/15 (80%)
Total daily requests: 192 (96 + 96)
Both deployments safe within limits
Recommended approach for stable operation
```

---

## 🛠️ **DEPLOYMENT STEPS:**

### **1. Setup Day Shift Deployment:**
```bash
# Create new Railway project
railway new tiktok-scraper-day

# Connect GitHub repo
railway connect

# Set environment variables (copy from above)
railway add RATE_LIMIT_REQUESTS_PER_MINUTE=5
railway add AUTO_CHECKER_INTERVAL=5400000
# ... (add all variables)

# Deploy
railway up
```

### **2. Setup Night Shift Deployment:**
```bash
# Create second Railway project  
railway new tiktok-scraper-night

# Connect same GitHub repo (different branch if needed)
railway connect

# Set environment variables for night shift
railway add RATE_LIMIT_REQUESTS_PER_MINUTE=5
railway add AUTO_CHECKER_INTERVAL=5400000
# ... (add all variables)

# Deploy
railway up
```

### **3. Configure Account Lists:**
- Day deployment uses `account_day_shift.txt` → copy to `account.txt`
- Night deployment uses `account_night_shift.txt` → copy to `account.txt`

---

## 📱 **MONITORING & MANAGEMENT:**

### **Access URLs:**
```
Day Shift: https://tiktok-scraper-day.railway.app
Night Shift: https://tiktok-scraper-night.railway.app
```

### **Data Export:**
```
Day CSV: https://tiktok-scraper-day.railway.app/api/save-and-download-csv
Night CSV: https://tiktok-scraper-night.railway.app/api/save-and-download-csv
```

### **Health Checks:**
```
Day Health: https://tiktok-scraper-day.railway.app/healthz
Night Health: https://tiktok-scraper-night.railway.app/healthz
```

---

## ⚡ **BEST PRACTICES:**

### **1. Enable Autorecover on Both:**
- Visit both frontends
- Enable "Autorecover" toggle
- Start monitoring on both
- Verify status shows "ON"

### **2. Monitor Rate Limits:**
- Check Railway logs for rate limit warnings
- Both should show minimal rate limiting
- Adjust intervals if needed

### **3. Data Management:**
- Download CSV from both deployments
- Combine data for complete analysis
- Consider single Supabase for unified data

### **4. Maintenance:**
- Update both deployments simultaneously
- Test rate limits after updates
- Monitor performance during peak hours

---

## ✅ **EXPECTED RESULTS:**

### **Coverage:**
- ✅ 12 accounts monitored 24/7
- ✅ Day shift: 6 AM - 6 PM focus
- ✅ Night shift: 6 PM - 6 AM focus
- ✅ 80% of target accounts covered

### **Performance:**
- ✅ Zero rate limiting issues expected
- ✅ Sustainable 24/7 operation
- ✅ Auto-recovery after deployments
- ✅ Complete data persistence

### **Scalability:**
- 📈 Can add 1-2 more accounts to each later
- 📈 Can implement smart rotation system
- 📈 Future: merge to single deployment with rotation

**READY FOR DUAL DEPLOYMENT! 🚀**
