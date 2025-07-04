# Supabase Backup Optimization Guide

## Overview
Sistem backup ke Supabase telah dioptimalkan untuk menghindari penggunaan kuota yang berlebihan sambil mempertahankan keamanan data.

## Masalah Sebelumnya
- Setiap pemanggilan `saveLiveDataToFile()` memicu backup ke Supabase
- Backup dilakukan secara real-time tanpa batching
- Tidak ada deduplication, menyebabkan backup berulang
- Log terminal yang berlebihan dari backup yang terlalu sering

## Solusi Optimasi

### 1. Batching & Throttling
```javascript
// Konfigurasi dalam .env
SUPABASE_BACKUP_INTERVAL=300000          // 5 menit
SUPABASE_BACKUP_DEBOUNCE_DELAY=30000     // 30 detik
SUPABASE_BACKUP_BATCH_SIZE=50            // 50 sesi per batch
SUPABASE_BACKUP_FORCE_INTERVAL=1800000   // 30 menit
```

### 2. Deduplication
- Sistem menghitung hash dari data untuk mendeteksi perubahan
- Backup hanya dilakukan jika ada perubahan data
- Mencegah backup berulang untuk data yang sama

### 3. Debouncing
- Backup dijeda selama 30 detik setelah perubahan data
- Jika ada perubahan lagi dalam 30 detik, timer direset
- Mengurangi frekuensi backup untuk perubahan yang cepat

### 4. Scheduled Backup
- Backup terjadwal setiap 5 menit (dapat dikonfigurasi)
- Backup paksa setiap 30 menit untuk memastikan tidak ada data yang hilang
- Backup otomatis saat server shutdown

## Endpoint Baru

### Manual Backup
```bash
POST /api/force-supabase-backup
```
Memaksa backup segera tanpa menunggu interval

### Status Backup
```bash
GET /api/supabase-status
```
Menampilkan status backup dan statistik

## Konfigurasi Rekomendasi

### Untuk Produksi (1 Bulan Aman)
```env
SUPABASE_BACKUP_ENABLED=true
SUPABASE_BACKUP_INTERVAL=600000          # 10 menit
SUPABASE_BACKUP_BATCH_SIZE=50            # 50 sesi per batch
SUPABASE_BACKUP_DEBOUNCE_DELAY=60000     # 1 menit
SUPABASE_BACKUP_FORCE_INTERVAL=3600000   # 1 jam
```

### Untuk Development (Backup Cepat)
```env
SUPABASE_BACKUP_ENABLED=true
SUPABASE_BACKUP_INTERVAL=300000          # 5 menit
SUPABASE_BACKUP_BATCH_SIZE=25            # 25 sesi per batch
SUPABASE_BACKUP_DEBOUNCE_DELAY=30000     # 30 detik
SUPABASE_BACKUP_FORCE_INTERVAL=1800000   # 30 menit
```

## Estimasi Penggunaan Kuota

### Sebelum Optimasi
- Backup: Setiap save (bisa 100+ kali/jam)
- Kuota: ~50MB-100MB/hari
- Durasi: 3-7 hari sebelum kuota habis

### Setelah Optimasi
- Backup: Maksimal 6x/jam (10 menit interval)
- Kuota: ~5MB-10MB/hari
- Durasi: 30+ hari dengan kuota free tier

## Monitoring

### Log Messages
- `🔄 Starting optimized Supabase backup...` - Backup dimulai
- `📦 Processing batch X (Y sessions)...` - Proses batch
- `✅ Optimized Supabase backup completed` - Backup selesai
- `⏭️ Skipping Supabase backup (no data changes)` - Skip karena tidak ada perubahan
- `⏰ Scheduling Supabase backup in Xs...` - Backup dijadwalkan

### Status Endpoint
Gunakan `GET /api/supabase-status` untuk memonitor:
- Waktu backup terakhir
- Status pending backup
- Jumlah total sesi
- Konfigurasi backup

## Troubleshooting

### Backup Tidak Jalan
1. Periksa `SUPABASE_BACKUP_ENABLED=true`
2. Periksa konfigurasi Supabase URL dan KEY
3. Periksa log untuk error message

### Kuota Habis Terlalu Cepat
1. Tingkatkan `SUPABASE_BACKUP_INTERVAL` ke 1800000 (30 menit)
2. Kurangi `SUPABASE_BACKUP_BATCH_SIZE` ke 25
3. Tingkatkan `SUPABASE_BACKUP_DEBOUNCE_DELAY` ke 120000 (2 menit)

### Log Terlalu Banyak
1. Set `LOG_LEVEL=error` untuk mengurangi log
2. Atau filter log dengan grep: `npm start | grep -v "Supabase backup"`

## Keamanan Data

### Redundansi
- Data disimpan di local file (`live_data.json`)
- Backup ke Supabase secara berkala
- Backup paksa saat server shutdown

### Recovery
- Server startup otomatis load dari Supabase
- Fallback ke local file jika Supabase tidak tersedia
- Manual backup tersedia melalui API endpoint

---
*Optimasi ini memastikan sistem berjalan stabil selama 1 bulan tanpa melebihi kuota Supabase free tier*
