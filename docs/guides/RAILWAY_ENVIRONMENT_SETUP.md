# 🚀 RAILWAY ENVIRONMENT VARIABLES CONFIGURATION

**Copy and paste these to Railway Dashboard → Environment Variables**

---

## 🔧 **REQUIRED VARIABLES:**

### **Supabase Database (CRITICAL!):**
```
SUPABASE_URL=https://wilruvbfexhwqbindoon.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHJ1dmJmZXhod3FiaW5kb29uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTUzNjc0MSwiZXhwIjoyMDY3MTEyNzQxfQ.X2CI1qej3ZMcGayVuhUhsMiB5TTkVsSGtmkeR1DdD6E
```

### **Production Configuration:**
```
NODE_ENV=production
PORT=3000
```

### **Rate Limiting (Optimized for 3 accounts):**
```
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=3
RATE_LIMIT_REQUESTS_PER_HOUR=50
RATE_LIMIT_REQUEST_DELAY=3000
```

### **Auto-Checker (60 minutes interval):**
```
AUTO_CHECKER_INTERVAL=3600000
AUTO_CHECKER_ENABLED=true
```

### **Session Detection:**
```
SESSION_DETECTION_ENABLED=true
SESSION_TIME_GAP_THRESHOLD=600000
SESSION_MAX_DURATION=43200000
SESSION_ROOM_ID_REUSE_DETECTION=true
```

### **Logging Configuration:**
```
LOG_LEVEL=info
LOG_ENHANCED_RATE_LIMITING=true
LOG_SESSION_DETECTION=true
```

### **EulerStream Rate Limiting:**
```
EULERSTREAM_RATE_LIMIT_CHECK_INTERVAL=300000
EULERSTREAM_ADAPTIVE_RATE_LIMITING=true
```

### **WebSocket & Data Configuration:**
```
WEBSOCKET_ENABLED=true
WEBSOCKET_CORS_ORIGIN=*
DATA_PERSISTENCE_ENABLED=true
CSV_EXPORT_ENABLED=true
JSON_EXPORT_ENABLED=true
```

---

## 📋 **STEP-BY-STEP SETUP:**

### **1. Railway Dashboard:**
1. Go to: https://railway.app/dashboard
2. Open your TikTok Scraper project
3. Click on "Variables" tab
4. Click "Add Variable" for each environment variable above

### **2. Critical Variables (MUST SET):**
```
✅ SUPABASE_URL → https://wilruvbfexhwqbindoon.supabase.co
✅ SUPABASE_SERVICE_ROLE_KEY → (copy the long JWT token above)
✅ NODE_ENV → production
✅ RATE_LIMIT_REQUESTS_PER_MINUTE → 3
✅ AUTO_CHECKER_INTERVAL → 3600000
```

### **3. After Setting Variables:**
1. Railway will automatically redeploy
2. Check logs for: "✅ Supabase initialized successfully"
3. Should see: "✅ Loaded X sessions from Supabase"
4. No more JSON errors

---

## 🔍 **VERIFICATION:**

### **Expected Logs After Deployment:**
```
✅ Supabase initialized successfully
🔗 Connected to: https://wilruvbfexhwqbindoon.supabase.co
Loading data from Supabase...
✅ Loaded 7 sessions from Supabase for 7 users
✅ Loaded 7 users from Supabase
Server running on http://localhost:3000
All accounts initialized as offline on server start.
```

### **No More These Errors:**
```
❌ ℹ️ Supabase not configured, using local file storage
❌ 🔍 Debug - URL: https://your-project.supabase.co
❌ Failed to load local data: Unexpected end of JSON input
```

---

## ⚡ **QUICK COPY-PASTE FOR RAILWAY:**

**For quick setup, copy this entire block to Railway:**

```
SUPABASE_URL=https://wilruvbfexhwqbindoon.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpbHJ1dmJmZXhod3FiaW5kb29uIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTUzNjc0MSwiZXhwIjoyMDY3MTEyNzQxfQ.X2CI1qej3ZMcGayVuhUhsMiB5TTkVsSGtmkeR1DdD6E
NODE_ENV=production
PORT=3000
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=3
RATE_LIMIT_REQUESTS_PER_HOUR=50
RATE_LIMIT_REQUEST_DELAY=3000
AUTO_CHECKER_INTERVAL=3600000
AUTO_CHECKER_ENABLED=true
SESSION_DETECTION_ENABLED=true
SESSION_TIME_GAP_THRESHOLD=600000
SESSION_MAX_DURATION=43200000
LOG_LEVEL=info
LOG_ENHANCED_RATE_LIMITING=true
LOG_SESSION_DETECTION=true
EULERSTREAM_RATE_LIMIT_CHECK_INTERVAL=300000
EULERSTREAM_ADAPTIVE_RATE_LIMITING=true
WEBSOCKET_ENABLED=true
WEBSOCKET_CORS_ORIGIN=*
DATA_PERSISTENCE_ENABLED=true
CSV_EXPORT_ENABLED=true
JSON_EXPORT_ENABLED=true
```

---

## 🚨 **TROUBLESHOOTING:**

### **If Still Getting Errors:**
1. **Check Railway Variables**: Make sure all variables are set correctly
2. **Redeploy**: Click "Deploy" button in Railway to force redeploy
3. **Check Logs**: Look for Supabase connection success message
4. **Environment**: Verify NODE_ENV=production

### **If Supabase Connection Fails:**
1. Check Supabase project is still active
2. Verify the service role key hasn't expired
3. Check Supabase project URL in dashboard

---

**After setting these variables, Railway will automatically redeploy and all issues should be resolved! 🚀**
