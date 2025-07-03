# 🔄 AUTO-RECOVERY & AUTO-RESTART BEHAVIOR

**Project:** TikTok Live Scraper v2 Enhanced  
**Date:** July 3, 2025

---

## 🎯 **PERTANYAAN UTAMA:**

> **"Saat redeploy/restart, apakah sistem otomatis lanjut monitoring atau harus manual restart?"**

**JAWABAN:** ✅ **OTOMATIS LANJUT** - Tidak perlu intervensi manual!

---

## 🔄 **BEHAVIOR SAAT REDEPLOY/RESTART**

### ✅ **SISTEM SUDAH DIIMPLEMENTASI:**

1. **Auto-Recovery Detection**
   - Sistem menyimpan status autorecover di file `autorecover.flag`
   - Saat server restart, sistem membaca flag ini
   - Jika flag ada = otomatis lanjut monitoring

2. **Auto-Start Sequence**
   ```
   Server Restart/Redeploy
        ↓
   Load autorecover.flag
        ↓
   initializeServer() - Load data dari Supabase
        ↓
   doAutorecover() - Jika flag ON
        ↓
   Auto Check-Live → Auto Start Scraping
   ```

3. **Persistent State Management**
   - ✅ Data sessions tersimpan di Supabase
   - ✅ Autorecover status tersimpan di file flag
   - ✅ Account list tersimpan di account.txt

---

## 📋 **BEHAVIOR MATRIX:**

| Kondisi Sebelum Redeploy | Behavior Setelah Restart | Manual Action Needed |
|---------------------------|---------------------------|---------------------|
| **Monitoring OFF** | Tetap OFF | ❌ None |
| **Monitoring ON + Autorecover OFF** | Monitoring STOP | ✅ Manual restart needed |
| **Monitoring ON + Autorecover ON** | **Monitoring AUTO-START** | ❌ None |
| **Live session aktif** | Session history preserved | ❌ None |

---

## 🚀 **SCENARIO EXAMPLES:**

### **Scenario 1: Normal Operation (RECOMMENDED)**
```
User Action: Enable Autorecover → Start Monitoring
Railway Action: Redeploy/Update
Result: ✅ Monitoring otomatis lanjut, tidak perlu buka frontend
```

### **Scenario 2: Manual Operation**
```
User Action: Start Monitoring (tanpa Autorecover)
Railway Action: Redeploy/Update
Result: ❌ Monitoring stop, perlu manual restart di frontend
```

### **Scenario 3: Data Preservation**
```
Before Redeploy: Ada 50 session data
After Redeploy: ✅ Semua 50 session masih ada (load dari Supabase)
CSV Download: ✅ Tetap bisa download semua data
```

---

## ⚡ **IMPLEMENTASI KODE:**

### **1. Autorecover Flag Management**
```javascript
// Saat user enable autorecover
autorecover = true;
fs.writeFileSync(autorecoverFile, 'on');

// Saat server startup
if (fs.existsSync(autorecoverFile)) {
    autorecover = true;
    console.log('✅ Autorecover flag detected - Auto-recovery enabled');
}
```

### **2. Auto-Start Sequence**
```javascript
async function doAutorecover() {
    if (autorecover) {
        console.log('Autorecover ON: starting check-live and scraping');
        // Auto check-live
        await checkLiveAccounts();
        // Auto start scraping
        await startScrapingAll();
    }
}
// Run saat server start
doAutorecover();
```

### **3. Data Persistence**
```javascript
// Load data from Supabase on startup
const supabaseData = await supabaseClient.loadDataFromSupabase();
Object.assign(liveDataStore, supabaseData);
```

---

## 📧 **NOTIFICATION SCENARIOS:**

### **Email dari Railway: "App Redeployed"**

**✅ JIKA AUTORECOVER ON:**
- ✅ Tidak perlu action apapun
- ✅ System otomatis lanjut monitoring
- ✅ Data tetap tersedia
- ✅ CSV download tetap berfungsi

**❌ JIKA AUTORECOVER OFF:**
- ❌ Perlu buka frontend
- ❌ Klik "Check Live Accounts"
- ❌ Klik "Start All Scraping"

### **Email dari Railway: "App Crashed/Restarted"**

**Sama seperti redeploy - behavior tergantung autorecover flag**

---

## 🎯 **BEST PRACTICE RECOMMENDATIONS:**

### **✅ UNTUK PRODUCTION:**
1. **Selalu enable Autorecover** sebelum start monitoring
2. **Verify autorecover status** di frontend dashboard
3. **Set notification** untuk monitor Railway deployment emails
4. **Periodic check** frontend untuk memastikan semua running

### **✅ MONITORING WORKFLOW:**
```
1. Buka frontend
2. Enable "Autorecover" (toggle ON)
3. Click "Check Live Accounts"
4. Click "Start All Scraping"
5. ✅ DONE - System akan auto-restart setelah redeploy
```

---

## 🔍 **VERIFICATION CHECKLIST:**

Setelah redeploy, untuk memastikan system berjalan:

### **✅ Quick Check (30 seconds):**
1. Buka frontend: `https://your-app.railway.app/`
2. Lihat dashboard status:
   - ✅ Autorecover: ON
   - ✅ Monitoring: ON  
   - ✅ Scraping: ON
3. Lihat account cards - ada yang online
4. Test CSV download - data masih ada

### **✅ Deep Check (2 minutes):**
1. Check Railway logs untuk error
2. Verify WebSocket connection
3. Test real-time updates
4. Confirm data persistence

---

## 🚨 **TROUBLESHOOTING:**

### **Problem: Monitoring tidak auto-start setelah redeploy**
**Solution:**
1. Check apakah `autorecover.flag` ada di server
2. Check Railway logs untuk error saat startup
3. Manual restart: buka frontend → enable autorecover → start monitoring

### **Problem: Data hilang setelah redeploy**
**Solution:**
1. Check Supabase connection di Railway environment variables
2. Check Railway logs untuk Supabase errors
3. Fallback: restore dari backup local jika ada

### **Problem: CSV download kosong**
**Solution:**
1. Check apakah data loaded dari Supabase
2. Restart monitoring untuk populate data
3. Check `/api/live-data` endpoint untuk debug

---

## ✅ **KESIMPULAN:**

**🎯 DENGAN AUTORECOVER ON:**
- ✅ Zero manual intervention needed
- ✅ System otomatis recover setelah redeploy
- ✅ Data persistence guaranteed
- ✅ Production-ready untuk unattended operation

**🎯 DENGAN AUTORECOVER OFF:**
- ❌ Manual restart required setelah redeploy
- ✅ Data tetap preserved (Supabase)
- ❌ Not recommended untuk production

**RECOMMENDATION: Selalu gunakan Autorecover ON untuk production deployment.**
