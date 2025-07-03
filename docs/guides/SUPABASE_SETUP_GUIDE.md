# 🚀 SUPABASE SETUP GUIDE - STEP BY STEP

## 🎯 GOAL
Mengatasi masalah data loss saat redeploy Railway dengan menggunakan Supabase sebagai persistent database.

## ⚡ QUICK START (15 menit setup)

### **Step 1: Buat Supabase Account & Project**

1. **Daftar di Supabase**: https://supabase.com
2. **Login** dengan GitHub/Google
3. **Create New Project**:
   - Project Name: `tiktok-live-scraper-v2`
   - Organization: Pilih default
   - Database Password: Buat password yang kuat (simpan!)
   - Region: Singapore (terdekat dengan Railway)
4. **Wait** hingga project selesai di-setup (~2 menit)

### **Step 2: Setup Database Schema**

1. **Buka Supabase Dashboard** → Project Anda
2. **Klik "SQL Editor"** di sidebar kiri
3. **Copy-paste** seluruh isi file `supabase-schema.sql`
4. **Klik "RUN"** untuk execute SQL
5. **Verify**: Cek tab "Table Editor" → harus ada table `live_sessions`

### **Step 3: Get API Keys**

1. **Klik "Settings"** di sidebar
2. **Klik "API"**
3. **Copy keys berikut**:
   ```
   Project URL: https://xxxxx.supabase.co
   anon public key: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
   service_role key: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
   ```

### **Step 4: Install Dependencies**

```bash
npm install @supabase/supabase-js
```

### **Step 5: Set Environment Variables**

**Local (.env file)**:
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
```

**Railway Dashboard**:
1. Buka Railway project Anda
2. Klik "Variables"
3. Add variables:
   - `SUPABASE_URL` = https://xxxxx.supabase.co
   - `SUPABASE_SERVICE_ROLE_KEY` = eyJ0eXAi...

### **Step 6: Test Connection**

```bash
node migrate-to-supabase.js
```

**Expected Output**:
```
🚀 TikTok Live Scraper - Supabase Migration Tool

🔍 Testing Supabase connection...
✅ Supabase connection successful!
📊 Found 0 users with data in Supabase

🔄 Starting migration to Supabase...
✅ Loaded existing live_data.json
✅ Backup completed: X sessions saved to Supabase
✅ Migration completed successfully!

🎉 Migration process completed!
```

---

## 📊 INTEGRATION WITH SERVER

### **Modified server.js functions**:

```javascript
// Add at top of server.js
const supabaseClient = require('./supabase-client');

// Initialize Supabase on server start
supabaseClient.initializeSupabase();

// Modified saveLiveDataToFile function
function saveLiveDataToFile() {
    // Original file save
    fs.writeFileSync(liveDataFile, JSON.stringify(liveDataStore, null, 2));
    
    // NEW: Auto-backup to Supabase
    if (supabaseClient.useSupabase()) {
        supabaseClient.backupToSupabase(liveDataStore)
            .catch(error => console.error('Supabase backup failed:', error));
    }
}

// Modified server startup - load from Supabase
async function initializeServer() {
    // Load from Supabase first
    if (supabaseClient.useSupabase()) {
        console.log('Loading data from Supabase...');
        const supabaseData = await supabaseClient.loadDataFromSupabase();
        if (Object.keys(supabaseData).length > 0) {
            liveDataStore = supabaseData;
            console.log('✅ Data loaded from Supabase');
        }
    }
    
    // Fallback to local file
    if (Object.keys(liveDataStore).length === 0) {
        // Original file loading logic...
    }
}
```

---

## ✅ VERIFICATION STEPS

### **Test Data Persistence**:

1. **Start scraping** beberapa account
2. **Wait** hingga ada data di `live_data.json`
3. **Run migration**: `node migrate-to-supabase.js`
4. **Check Supabase**: Dashboard → Table Editor → live_sessions (harus ada data)
5. **Simulate redeploy**: Delete `live_data.json` dan restart server
6. **Verify**: Data harus ter-load dari Supabase

### **Test Railway Deployment**:

1. **Deploy** ke Railway dengan Supabase env vars
2. **Start scraping** 
3. **Redeploy** aplikasi
4. **Check**: Data masih ada setelah redeploy ✅

---

## 🎯 BENEFITS SETELAH SETUP

### **Data Persistence**:
- ✅ **Zero Data Loss**: Data tersimpan permanen
- ✅ **Auto Backup**: Setiap session otomatis backup ke Supabase
- ✅ **Cross-deployment**: Data tersedia di semua deployment

### **Scalability**:
- ✅ **500MB Free**: Cukup untuk jutaan sessions
- ✅ **Real-time**: Data sync real-time
- ✅ **Analytics**: Built-in dashboard untuk analisis

### **Reliability**:
- ✅ **High Availability**: 99.9% uptime
- ✅ **Auto Backup**: Daily backups
- ✅ **Point-in-time Recovery**: Restore ke waktu tertentu

---

## 🚨 TROUBLESHOOTING

### **Connection Failed**:
- ✅ Check SUPABASE_URL format
- ✅ Verify SERVICE_ROLE_KEY (bukan anon key)
- ✅ Ensure SQL schema sudah di-run

### **Migration Failed**:
- ✅ Check file permissions
- ✅ Verify live_data.json exists dan valid
- ✅ Check Supabase project status

### **Data Not Loading**:
- ✅ Check environment variables di Railway
- ✅ Verify table structure di Supabase
- ✅ Check server logs untuk error messages

---

## 💰 COST

| Tier | Storage | Price | Features |
|------|---------|-------|----------|
| **Free** | 500MB | $0/month | ✅ Perfect untuk start |
| **Pro** | 8GB | $25/month | ✅ Advanced features |

**Recommendation**: Start dengan Free tier, upgrade jika diperlukan.

---

## 🎉 READY TO IMPLEMENT?

**Yang Anda butuhkan**:
1. ✅ 15 menit setup time
2. ✅ Supabase account (gratis)
3. ✅ Copy-paste beberapa code
4. ✅ Set 2 environment variables

**Result**:
- ✅ Data tidak akan hilang lagi saat redeploy
- ✅ Backup otomatis setiap session
- ✅ Akses data dari mana saja
- ✅ Built-in analytics dashboard

**Apakah Anda ingin saya implementasikan sekarang?** 🚀
