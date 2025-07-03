# 🤖 AUTOCHECKER FUNCTION DOCUMENTATION

## ✅ PERUBAHAN INTERVAL UNTUK TESTING

**Interval Original**: 15 menit  
**Interval Testing**: 2 menit (untuk mempercepat testing)

## 🔄 CARA KERJA AUTOCHECKER

### **1. Trigger Autochecker**
Autochecker dimulai secara otomatis ketika:
- User melakukan **"Start Scraping"** (`/api/start-scraping-all`)
- Monitoring status berubah menjadi `true`

### **2. Siklus Autochecker (Setiap 2 menit)**
```javascript
setInterval(async () => {
    // 1. Cek hanya akun yang offline
    const offlineToCheck = offlineAccounts.filter(username => username.trim());
    
    // 2. Jika tidak ada akun offline, hentikan autochecker
    if (offlineToCheck.length === 0) {
        console.log('Autochecker: Semua akun sudah live, autochecker dihentikan.');
        stopAutochecker();
        return;
    }
    
    // 3. Check live status akun offline dengan rate limiting
    await checkLiveAccounts(offlineToCheck);
    
    // 4. Update account status lists
    emitAccountStatusUpdate();
    
    // 5. Auto-trigger scraping jika ada akun baru yang online
    if (liveAccounts.length > 0 && isMonitoring) {
        // Start scraping untuk akun yang baru online
    }
}, 2 * 60 * 1000); // 2 menit
```

### **3. Fungsi Utama Autochecker**

#### **Check Live Accounts**
- Menggunakan rate limiting untuk menghindari spam API TikTok
- Hanya mengecek akun yang statusnya `offline`
- Update status menjadi `online`, `offline`, atau `error`

#### **Auto-Stop Condition**
Autochecker akan **otomatis berhenti** jika:
- Semua akun sudah `online` (tidak ada yang `offline`)
- User melakukan "Stop & Reset"

#### **Auto-Start Scraping**
Jika ada akun baru yang berubah dari `offline` → `online`:
- Autochecker akan trigger scraping untuk akun baru tersebut
- Scraping berjalan otomatis tanpa user perlu klik tombol

### **4. Status Monitoring**

#### **Status Bar Frontend**
```
Autochecker: ON | Monitoring: ON | Scraping: ON | Autorecover: ON
```

#### **Console Logs Server**
```
[timestamp] Autochecker started (interval 2 menit)
[timestamp] Autochecker: Checking 5 offline accounts...
[timestamp] Autochecker: Found 2 new live accounts
[timestamp] Autochecker: Semua akun sudah live, autochecker dihentikan.
```

### **5. API Endpoints Terkait**

| Endpoint | Function | Autochecker Effect |
|----------|----------|-------------------|
| `/api/start-scraping-all` | Start monitoring & scraping | ✅ Start autochecker |
| `/api/stop-scraping-and-reset` | Stop semua aktivitas | ✅ Stop autochecker |
| `/api/check-live` | Manual check account status | ⚠️ Tidak mempengaruhi autochecker |

### **6. Test Results**

#### **Test Scenario:**
1. ✅ **Start Monitoring**: Autochecker ON
2. ⏰ **Wait 2 minutes**: Autochecker should run automatically
3. 📊 **Check Logs**: Server logs show autochecker activity
4. 🔄 **Continuous Cycle**: Autochecker runs every 2 minutes until all accounts online

#### **Expected Behavior:**
```
10:00:31 AM - Autochecker started (interval 2 menit)
10:02:31 AM - Autochecker: Checking 23 offline accounts...
10:04:31 AM - Autochecker: Checking X offline accounts...
...and so on every 2 minutes
```

### **7. Production vs Testing**

| Mode | Interval | Purpose |
|------|----------|---------|
| **Production** | 15 menit | Normal operation, tidak spam API |
| **Testing** | 2 menit | Quick testing, development |

### **8. Benefits**

- ✅ **Automatic**: No manual intervention required
- ✅ **Efficient**: Only checks offline accounts
- ✅ **Smart**: Auto-stops when all accounts online
- ✅ **Rate Limited**: Prevents API abuse
- ✅ **Real-time**: Immediately starts scraping for new live accounts

---

**Status**: ✅ Autochecker configured for 2-minute testing  
**Next**: Monitor test results and verify functionality
