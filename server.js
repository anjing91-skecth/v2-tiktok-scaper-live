const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { WebcastPushConnection } = require("tiktok-live-connector");
const http = require('http');
const { Server } = require('socket.io');

// Load environment variables
require('dotenv').config();

// Import Supabase client
const supabaseClient = require('./supabase-client');

// Production Configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const PORT = process.env.PORT || 3000;

// Rate Limiting Configuration
const RATE_LIMIT_ENABLED = process.env.RATE_LIMIT_ENABLED !== 'false';
const RATE_LIMIT_REQUESTS_PER_MINUTE = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 8;
const RATE_LIMIT_REQUESTS_PER_HOUR = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR) || 50;
const RATE_LIMIT_REQUEST_DELAY = parseInt(process.env.RATE_LIMIT_REQUEST_DELAY) || 1000;

// Session Detection Configuration
const SESSION_DETECTION_ENABLED = process.env.SESSION_DETECTION_ENABLED !== 'false';
const SESSION_TIME_GAP_THRESHOLD = parseInt(process.env.SESSION_TIME_GAP_THRESHOLD) || 600000; // 10 minutes
const SESSION_MAX_DURATION = parseInt(process.env.SESSION_MAX_DURATION) || 43200000; // 12 hours

// Auto-Checker Configuration
const AUTO_CHECKER_INTERVAL = parseInt(process.env.AUTO_CHECKER_INTERVAL) || 900000; // 15 minutes
const AUTO_CHECKER_ENABLED = process.env.AUTO_CHECKER_ENABLED !== 'false';

// Logging Configuration
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_ENHANCED_RATE_LIMITING = process.env.LOG_ENHANCED_RATE_LIMITING !== 'false';
const LOG_SESSION_DETECTION = process.env.LOG_SESSION_DETECTION !== 'false';

// EulerStream Configuration
const EULERSTREAM_RATE_LIMIT_CHECK_INTERVAL = parseInt(process.env.EULERSTREAM_RATE_LIMIT_CHECK_INTERVAL) || 300000; // 5 minutes
const EULERSTREAM_ADAPTIVE_RATE_LIMITING = process.env.EULERSTREAM_ADAPTIVE_RATE_LIMITING !== 'false';

// Application State
let autorecover = false;
let isMonitoring = false;

const app = express();
const accountFilePath = path.join(__dirname, 'data', 'accounts', 'account.txt');
const logFilePath = path.join(__dirname, 'scraping.log');
const liveDataFile = path.join(__dirname, 'data', 'live_data.json');
const csvFilePath = path.join(__dirname, 'data', 'live_data.csv');
const autorecoverFile = path.join(__dirname, 'autorecover.flag');

// CORS Configuration for Production
const corsOptions = {
    origin: process.env.WEBSOCKET_CORS_ORIGIN || (isDevelopment ? "*" : false),
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());

// Clear log file on startup
fs.writeFileSync(logFilePath, '');

// Serve the frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend.html'));
});

// Edit username list
app.post('/api/edit-list', (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames)) {
        return res.status(400).json({ error: 'Usernames must be an array.' });
    }
    fs.writeFileSync(accountFilePath, usernames.join('\n'));
    res.json({ message: 'Username list updated.', usernames });
});

// Store live, offline, error, and connected accounts
let liveAccounts = [];
let offlineAccounts = [];
let errorAccounts = [];
let connectedAccounts = [];

// Initialize live data store
let liveDataStore = {};

// Initialize Supabase and load data on server start
async function initializeServer() {
    try {
        // Initialize Supabase
        supabaseClient.initializeSupabase();
        
        // Load data from Supabase first
        if (supabaseClient.useSupabase()) {
            console.log('Loading data from Supabase...');
            const supabaseData = await supabaseClient.loadDataFromSupabase();
            if (Object.keys(supabaseData).length > 0) {
                Object.assign(liveDataStore, supabaseData);
                console.log(`✅ Loaded ${Object.keys(supabaseData).length} users from Supabase`);
            }
        }
        
        // Load from local file as fallback
        if (fs.existsSync(liveDataFile)) {
            try {
                const localData = JSON.parse(fs.readFileSync(liveDataFile, 'utf-8'));
                // Merge local data dengan Supabase data
                Object.assign(liveDataStore, localData);
                console.log('Local data loaded as backup');
            } catch (e) {
                console.error('Failed to load local data:', e.message);
            }
        }
        
        // Initialize accounts as offline
        const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
        offlineAccounts = [...new Set(usernames)];
        liveAccounts = [];
        connectedAccounts = [];
        errorAccounts = [];
        console.log('All accounts initialized as offline on server start.');
        
        // Load autorecover status from file
        if (fs.existsSync(autorecoverFile)) {
            autorecover = true;
            console.log('✅ Autorecover flag detected - Auto-recovery enabled');
        } else {
            autorecover = false;
            console.log('ℹ️ No autorecover flag - Auto-recovery disabled');
        }
        
    } catch (e) {
        console.error('Failed to initialize server:', e.message);
    }
}

// Run initialization
initializeServer();

// --- CONNECTION MANAGEMENT REFACTOR ---
// Use a single connection per account, reused between check-live and scraping
// Attach listeners only on start-scraping, not during check-live
// Robust reconnect logic: try 2 times, then move to offline and cleanup

// Map to track if listeners are attached
const listenersAttached = {};
let activeConnections = {};
let reconnectAttempts = {};
// Patch: check-live only connects, does not disconnect, and stores connection in activeConnections
app.post('/api/check-live', async (req, res) => {
    const accountsToCheck = [...offlineAccounts];
    offlineAccounts = [];
    let live = [];
    let offline = [];
    let error = [];
    
    console.log(`[CHECK-LIVE] Checking ${accountsToCheck.length} accounts with rate limiting...`);
    
    for (const username of accountsToCheck) {
        let connection = activeConnections[username];
        if (!connection) {
            connection = new WebcastPushConnection(username);
            activeConnections[username] = connection;
        }
        try {
            // Apply rate limiting before connection
            await tikTokRateLimiter.canMakeRequest();
            
            await connection.connect();
            if (!liveAccounts.includes(username)) liveAccounts.push(username);
            live.push(username);
            console.log(`[CHECK-LIVE] ✅ ${username} is LIVE`);
        } catch (err) {
            if (err.message && err.message.includes("isn't online")) {
                offlineAccounts.push(username);
                offline.push(username);
                console.log(`[CHECK-LIVE] ⭕ ${username} is OFFLINE`);
            } else {
                errorAccounts.push(username);
                error.push(username);
                console.log(`[CHECK-LIVE] ❌ ${username} ERROR: ${err.message}`);
            }
        }
    }
    
    // Show rate limiter status
    const rateLimiterStatus = tikTokRateLimiter.getStatus();
    console.log(`[CHECK-LIVE] Rate limiter status: ${rateLimiterStatus.requests_made}/${rateLimiterStatus.max_requests} requests, ${rateLimiterStatus.hourly_requests} hourly`);
    
    // Setelah check, jika masih ada offline, aktifkan autochecker
    if (offlineAccounts.length > 0) {
        startAutochecker();
    } else {
        stopAutochecker();
    }
    res.json({ live, offline, error });
});

// Start scraping: attach listeners to existing connections, move to connected
app.post('/api/start-scraping-all', (req, res) => {
    // PATCH: Jangan return error jika liveAccounts.length === 0
    // isMonitoring harus tetap true meskipun tidak ada akun live
    isMonitoring = true;
    autorecover = true;
    fs.writeFileSync(autorecoverFile, 'on');
    // Tetap jalankan autochecker jika ada akun offline
    if (offlineAccounts.length > 0) {
        startAutochecker();
    }
    // Hanya attach listener jika ada akun live
    liveAccounts.forEach(username => {
        let connection = activeConnections[username];
        if (!connection) {
            connection = new WebcastPushConnection(username);
            activeConnections[username] = connection;
        }
        if (!listenersAttached[username]) {
            setupListeners({ conn: connection, uname: username });
            listenersAttached[username] = true;
        }
        if (!connectedAccounts.includes(username)) connectedAccounts.push(username);
        if (!liveDataStore[username]) {
            initLiveData(username, connection.state || {});
        }
    });
    emitStatusUpdate();
    emitAccountStatusUpdate();
    res.json({ message: 'Scraping started and monitoring enabled.' });
});

// Stop monitoring
app.post('/api/stop-monitoring', (req, res) => {
    isMonitoring = false;
    autorecover = false;
    if (fs.existsSync(autorecoverFile)) fs.unlinkSync(autorecoverFile);
    // Disconnect all active connections
    for (const uname in activeConnections) {
        try {
            activeConnections[uname].disconnect && activeConnections[uname].disconnect();
        } catch (e) {}
    }
    activeConnections = {};
    if (monitorLiveInterval) clearInterval(monitorLiveInterval);
    if (monitorConnectedInterval) clearInterval(monitorConnectedInterval);
    emitStatusUpdate();
    res.json({ message: 'Monitoring stopped.' });
});

// Stop and reset scraping, disconnect all, set all offline, save data
app.post('/api/stop-scraping-and-reset', async (req, res) => {
    // 1. Matikan autorecover di awal
    autorecover = false;
    if (fs.existsSync(autorecoverFile)) fs.unlinkSync(autorecoverFile);

    // 1b. Matikan autochecker jika aktif
    stopAutochecker();

    // 2. Save all data
    saveLiveDataToFile();
    saveLiveDataToCSV();

    // 3. Disconnect all connections
    for (const uname in activeConnections) {
        try {
            activeConnections[uname].disconnect && activeConnections[uname].disconnect();
        } catch (e) {}
    }
    activeConnections = {};
    if (monitorLiveInterval) clearInterval(monitorLiveInterval);
    if (monitorConnectedInterval) clearInterval(monitorConnectedInterval);

    // 4. Set all akun ke offline, kosongkan liveAccounts, connectedAccounts, dsb
    let usernames = [];
    try {
        usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
    } catch (e) {}
    offlineAccounts = [...new Set(usernames)];
    liveAccounts = [];
    connectedAccounts = [];
    errorAccounts = [];
    isMonitoring = false;
    // 5. Reset liveDataStore (jika ingin data baru, atau biarkan untuk histori)
    // Object.keys(liveDataStore).forEach(k => delete liveDataStore[k]);
    emitStatusUpdate();
    emitAccountStatusUpdate(); // PATCH: emit ke frontend agar UI langsung update
    res.json({ message: 'All monitoring stopped, all accounts set to offline, data saved, monitoring off.' });
});

// Get current username list
app.get('/api/get-list', (req, res) => {
    try {
        const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
        res.json({ usernames });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read username list.' });
    }
});

// Live data storage
// Tambahkan penyimpanan msgId yang sudah diproses per user
const processedGiftMsgIds = {};

function saveLiveDataToFile() {
    fs.writeFileSync(liveDataFile, JSON.stringify(liveDataStore, null, 2));
    saveLiveDataToCSV(); // Save CSV every time live_data.json is saved
    
    // NEW: Auto-backup to Supabase
    if (supabaseClient.useSupabase()) {
        supabaseClient.backupToSupabase(liveDataStore)
            .catch(error => console.error('Supabase backup failed:', error));
    }
}

function formatDateToGMT7(date) {
    const gmt7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return gmt7.toLocaleString('en-GB', { hour12: false }).replace(',', '');
}

// --- MULTI SESSION PATCH ---
// liveDataStore[username] = [ { ...session1... }, { ...session2... } ]
// Setiap sesi dibedakan dengan room_id (roomId TikTok).
// Saat roomId berubah, sesi lama di-finalize, gifts dikosongkan, leaderboard tetap, dan sesi baru dibuat.
// Saat reconnect, jika roomId sama, lanjutkan sesi; jika berbeda, buat sesi baru.
// Saat finalize, gifts dikosongkan, leaderboard tetap, timestamp_end & duration diisi.

// Helper: get current session (last) for a username
function getCurrentSession(username) {
    if (!liveDataStore[username] || !Array.isArray(liveDataStore[username])) return null;
    return liveDataStore[username][liveDataStore[username].length - 1];
}

// Helper: migrate old data (object) to array-of-sessions
function migrateLiveDataStoreFormat() {
    for (const username in liveDataStore) {
        if (!Array.isArray(liveDataStore[username])) {
            // Wrap old object as array
            liveDataStore[username] = [liveDataStore[username]];
        }
    }
    saveLiveDataToFile();
}

// Call migration on startup
migrateLiveDataStoreFormat();

function initLiveData(username, metadata) {
    migrateLiveDataStoreFormat(); // Ensure always array
    
    // Parse timestamps
    let timestampStart = null;
    let createTime = null;
    
    if (metadata && metadata.create_time) {
        createTime = new Date(metadata.create_time * 1000);
        timestampStart = formatDateToGMT7(createTime);
    } else {
        timestampStart = formatDateToGMT7(new Date());
    }
    
    const roomId = metadata && metadata.roomId ? metadata.roomId : null;
    const currentTime = new Date();
    
    // Get existing sessions
    let sessions = liveDataStore[username] || [];
    let lastSession = sessions[sessions.length - 1];
    
    // --- MULTI-FACTOR SESSION DETECTION ---
    const isSameSession = checkIfSameSession(lastSession, {
        roomId,
        createTime,
        currentTime,
        username
    });
    
    if (isSameSession) {
        // Lanjutkan sesi yang sama
        console.log(`[SESSION] Continuing existing session for ${username} (Room: ${roomId})`);
        return;
    }
    
    // Jika ada sesi live aktif yang berbeda, finalize dulu
    if (lastSession && lastSession.status === 'live') {
        console.log(`[SESSION] Finalizing previous session for ${username} (New session detected)`);
        finalizeLiveData(username);
    }
    // Buat sesi baru dengan data yang lebih lengkap
    const newSession = {
        username,
        room_id: roomId,
        session_id: generateSessionId(username, roomId, currentTime), // Unique session ID
        timestamp_start: timestampStart,
        timestamp_start_real: timestampStart, // Waktu sebenarnya live dimulai (dari TikTok)
        timestamp_monitoring_start: formatDateToGMT7(currentTime), // Waktu mulai monitoring
        create_time: createTime, // Store create_time untuk validasi
        last_update_time: currentTime, // Track last update untuk gap detection
        viewer: 0,
        peak_viewer: 0,
        gifts: [],
        total_diamond: 0,
        leaderboard: {},
        timestamp_end: null,
        duration: null,
        duration_monitored: null, // Durasi yang dimonitor
        status: 'live',
        // Metadata tambahan untuk tracking
        connection_attempts: 1,
        session_notes: [] // Catatan penting tentang session
    };
    
    // Add session start note
    newSession.session_notes.push({
        timestamp: formatDateToGMT7(currentTime),
        note: `Session started - Room: ${roomId}, Method: ${metadata?.method || 'auto'}`
    });
    
    console.log(`[SESSION] New session created for ${username}:`, {
        session_id: newSession.session_id,
        room_id: roomId,
        timestamp_start: timestampStart
    });
    if (!Array.isArray(liveDataStore[username])) liveDataStore[username] = [];
    liveDataStore[username].push(newSession);
    processedGiftMsgIds[username] = new Set();
    saveLiveDataToFile();
}

function updateLiveData(username, data) {
    migrateLiveDataStoreFormat();
    const session = getCurrentSession(username);
    if (!session) return;
    
    // Update session tracking
    updateSessionTracking(username);
    
    if (data.viewer !== undefined) {
        session.viewer = data.viewer;
        if (data.viewer > session.peak_viewer) {
            session.peak_viewer = data.viewer;
        }
    }
    if (data.viewerCount !== undefined) {
        session.viewer = data.viewerCount;
        if (data.viewerCount > session.peak_viewer) {
            session.peak_viewer = data.viewerCount;
        }
    }
    if (data.gift) {
        const lastGift = session.gifts[0];
        if (lastGift &&
            lastGift.gifter === data.gift.gifter &&
            lastGift.name === data.gift.name &&
            lastGift.timestamp === data.gift.timestamp
        ) {
            lastGift.count += data.gift.count;
            lastGift.diamond += data.gift.diamond;
        } else {
            session.gifts.unshift(data.gift);
        }
        session.gifts = session.gifts.slice(0, 10);
        session.total_diamond += data.gift.diamond || 0;
        const gifter = data.gift.gifter || 'unknown';
        if (!session.leaderboard[gifter]) session.leaderboard[gifter] = 0;
        session.leaderboard[gifter] += data.gift.diamond || 0;
    }
    
    // Add significant events to session notes
    if (data.significant_event) {
        session.session_notes.push({
            timestamp: formatDateToGMT7(new Date()),
            note: data.significant_event
        });
    }
    
    saveLiveDataToFile();
    emitLiveDataUpdate(username);
}

// --- PATCH: Simpan hanya 10 leaderboard teratas ke live_data.json saat finalize ---
function finalizeLiveData(username) {
    migrateLiveDataStoreFormat();
    const session = getCurrentSession(username);
    if (!session || session.status === 'finalized') return;
    session.timestamp_end = formatDateToGMT7(new Date());
    
    // Parse timestamp untuk durasi
    function parseDateString(str) {
        // Format: dd/MM/yyyy HH:mm:ss
        const [date, time] = str.split(' ');
        const [day, month, year] = date.split('/').map(Number);
        const [hour, minute, second] = time.split(':').map(Number);
        return new Date(year, month - 1, day, hour, minute, second);
    }
    
    // Hitung durasi sebenarnya live (dari timestamp_start_real ke timestamp_end)
    if (session.timestamp_start_real) {
        const startReal = parseDateString(session.timestamp_start_real);
        const end = parseDateString(session.timestamp_end);
        const durationMs = end - startReal;
        if (durationMs > 0) {
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            session.duration = `${minutes}m ${seconds}s`;
        } else {
            session.duration = '0m 0s';
        }
    }
    
    // Hitung durasi monitoring (dari timestamp_monitoring_start ke timestamp_end)
    if (session.timestamp_monitoring_start) {
        const startMonitoring = parseDateString(session.timestamp_monitoring_start);
        const end = parseDateString(session.timestamp_end);
        const monitoringMs = end - startMonitoring;
        if (monitoringMs > 0) {
            const minutes = Math.floor(monitoringMs / 60000);
            const seconds = Math.floor((monitoringMs % 60000) / 1000);
            session.duration_monitored = `${minutes}m ${seconds}s`;
        } else {
            session.duration_monitored = '0m 0s';
        }
    }
    session.status = 'finalized';
    session.gifts = [];
    // Simpan hanya 10 leaderboard teratas
    if (session.leaderboard) {
        const sorted = Object.entries(session.leaderboard).sort((a,b)=>b[1]-a[1]).slice(0,10);
        session.leaderboard = Object.fromEntries(sorted);
    }
    saveLiveDataToFile();
    emitLiveDataFinalize(username);
    saveLiveDataToCSV();
}

// --- SOCKET.IO EMIT HELPERS ---
function emitLiveDataUpdate(username) {
    io.emit('liveDataUpdate', { username, data: liveDataStore[username] });
}
function emitLiveDataFinalize(username) {
    io.emit('liveDataFinalize', { username, data: liveDataStore[username] });
}

// API to get live data for frontend
app.get('/api/live-data', (req, res) => {
    res.json(liveDataStore);
});

// Health check endpoint for Railway/production
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Emit status & account status to new socket.io client on connect
io.on('connection', (socket) => {
    emitStatusUpdate();
    emitAccountStatusUpdate();
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Periodic save every 15 minutes
setInterval(() => {
    saveLiveDataToCSV();
}, 15 * 60 * 1000);

// Save all live data to CSV on exit
process.on('SIGINT', () => {
    saveLiveDataToCSV();
    process.exit();
});
process.on('SIGTERM', () => {
    saveLiveDataToCSV();
    process.exit();
});

// CSV handling
function saveLiveDataToCSV() {
    // Header
    const header = [
        'tanggal dan jam', 'roomid', 'akun', 'durasi live', 'peakview', 'totalgift',
        ...Array.from({length: 10}, (_, i) => `topspender${i+1}`)
    ];
    let rows = [header.join('|')];
    for (const username in liveDataStore) {
        const sessions = liveDataStore[username];
        if (!Array.isArray(sessions)) continue;
        sessions.forEach(data => {
            if (!data.room_id) return; // skip if no room id
            const tgl = data.timestamp_start || '-';
            const row = [
                tgl,
                data.room_id,
                data.username,
                data.duration || '-',
                data.peak_viewer || 0,
                data.total_diamond || 0
            ];
            // Leaderboard sudah dipastikan hanya 10 teratas saat finalize, tapi tetap slice 10 untuk safety
            const sorted = Object.entries(data.leaderboard||{}).sort((a,b)=>b[1]-a[1]).slice(0,10);
            for (let i=0; i<10; i++) {
                if (sorted[i]) {
                    row.push(`${sorted[i][0]}(${sorted[i][1]})`);
                } else {
                    row.push('');
                }
            }
            rows.push(row.join('|'));
        });
    }
    fs.writeFileSync(csvFilePath, rows.join('\n'));
}

// Endpoint for save and download CSV
app.get('/api/save-and-download-csv', (req, res) => {
    saveLiveDataToCSV();
    res.download(csvFilePath, 'live_data.csv');
});

// Global error handler untuk mencegah server crash
process.on('uncaughtException', (err) => {
    const msg = `[uncaughtException] ${new Date().toISOString()} - ${err.stack || err}`;
    fs.appendFileSync(logFilePath, msg + '\n');
    console.error(msg);
    // Jangan exit, biarkan server tetap jalan
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = `[unhandledRejection] ${new Date().toISOString()} - ${reason && reason.stack ? reason.stack : reason}`;
    fs.appendFileSync(logFilePath, msg + '\n');
    console.error(msg);
    // Jangan exit, biarkan server tetap jalan
});

// --- AUTORECOVER PATCH ---
// On server start, if autorecover is on, trigger check-live and start-scraping
async function doAutorecover() {
    if (autorecover) {
        fs.appendFileSync(logFilePath, `[${new Date().toISOString()}] Autorecover ON: starting check-live and scraping\n`);
        // Jalankan check-live
        await new Promise(resolve => {
            app.handle({ method: 'POST', url: '/api/check-live' }, { json: () => resolve() });
        });
        // Jalankan scraping
        app.handle({ method: 'POST', url: '/api/start-scraping-all' }, { json: () => { emitStatusUpdate(); } });
    }
}
doAutorecover();

// --- FINALIZE HANGING LIVE SESSIONS ON STARTUP ---
function finalizeHangingLiveSessionsOnStartup() {
    let json = {};
    try {
        if (fs.existsSync(liveDataFile)) {
            json = JSON.parse(fs.readFileSync(liveDataFile, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to read/parse live_data.json:', e.message);
        return;
    }
    const usernamesToCheck = [];
    for (const username in json) {
        const session = json[username];
        if (session && !session.timestamp_end) {
            usernamesToCheck.push(username);
        }
    }
    if (usernamesToCheck.length === 0) return;
    // Cek status live untuk setiap akun yang sesi-nya masih "live"
    const checkAndFinalize = async () => {
        for (const username of usernamesToCheck) {
            // Cek apakah akun masih live
            const connection = new WebcastPushConnection(username);
            try {
                await connection.connect();
                // Masih live, biarkan saja, akan lanjut monitoring
                connection.disconnect && connection.disconnect();
            } catch (err) {
                // Sudah offline, finalize sesi
                finalizeLiveData(username);
            }
        }
    };
    checkAndFinalize();
}

// Jalankan saat startup
finalizeHangingLiveSessionsOnStartup();

// Fungsi untuk setup listeners pada koneksi TikTok
function setupListeners({ conn, uname }) {
    // Reset listeners jika sudah ada
    if (conn._events) {
        conn.removeAllListeners('gift');
        conn.removeAllListeners('roomUser');
        conn.removeAllListeners('streamData');
        conn.removeAllListeners('disconnected');
    }
    // Log pemasangan event listener
    const logMsg = `${new Date().toISOString()} - [LISTENER] Event listeners attached for ${uname}\n`;
    fs.appendFileSync(logFilePath, logMsg);
    console.log(logMsg);
    // Gift event
    conn.on('gift', (giftData) => {
        // Hanya proses jika giftType !== 1 atau (giftType === 1 dan repeatEnd === true)
        if (giftData.giftType === 1 && !giftData.repeatEnd) return;
        if (!giftData.msgId) return;
        if (processedGiftMsgIds[uname]?.has(giftData.msgId)) return;
        processedGiftMsgIds[uname]?.add(giftData.msgId);
        const eventTimestamp = giftData.timestamp || Date.now();
        const gifter = giftData.uniqueId || giftData.nickname || 'unknown';
        const giftName = giftData.giftName;
        const count = giftData.repeatCount || 1;
        const diamond = giftData.diamondCount || 0;
        updateLiveData(uname, {
            gift: {
                name: giftName,
                diamond: diamond * count,
                gifter: gifter,
                timestamp: eventTimestamp,
                count: count
            }
        });
    });
    // Viewer update
    conn.on('roomUser', (data) => {
        if (typeof data.viewerCount === 'number') {
            updateLiveData(uname, { viewer: data.viewerCount });
        }
    });
    // Fallback: streamData
    conn.on('streamData', (data) => {
        if (typeof data.viewerCount === 'number') {
            updateLiveData(uname, { viewer: data.viewerCount });
        } else if (typeof data.viewer === 'number') {
            updateLiveData(uname, { viewer: data.viewer });
        }
    });
    // Disconnect/reconnect logic
    conn.on('disconnected', async () => {
        finalizeLiveData(uname);
        const logMsg = `${new Date().toISOString()} - Disconnected from ${uname}. Checking status...\n`;
        fs.appendFileSync(logFilePath, logMsg);
        console.log(logMsg);
        let stillLive = false;
        try {
            stillLive = await (async function isAccountStillLive(username) {
                const connection = new WebcastPushConnection(username);
                try {
                    await connection.connect();
                    return true;
                } catch (error) {
                    return false;
                }
            })(uname);
        } catch (e) {}
        let prevStatus = liveAccounts.includes(uname) ? 'online' : 'offline';
        if (stillLive && reconnectAttempts[uname] < 2) {
            reconnectAttempts[uname]++;
            const retryMsg = `${new Date().toISOString()} - ${uname} still live, reconnect attempt ${reconnectAttempts[uname]}...\n`;
            fs.appendFileSync(logFilePath, retryMsg);
            console.log(retryMsg);
            setTimeout(() => {
                const newConn = new WebcastPushConnection(uname);
                activeConnections[uname] = newConn;
                setupListeners({ conn: newConn, uname });
                newConn.connect();
            }, 30000); // 30 seconds
        } else {
            connectedAccounts = connectedAccounts.filter(u => u !== uname);
            if (!offlineAccounts.includes(uname)) offlineAccounts.push(uname);
            const offMsg = `${new Date().toISOString()} - ${uname} moved to offline after disconnect.\n`;
            fs.appendFileSync(logFilePath, offMsg);
            console.log(offMsg);
            logStatusChange(uname, prevStatus, 'offline');
            emitAccountStatusUpdate(); // Emit update ke frontend agar kartu user hilang dan pindah ke offline
            // Patch: jika monitoring masih aktif dan autochecker belum aktif, jalankan autochecker
            if (isMonitoring && !autocheckerInterval) {
                startAutochecker();
            }
        }
    });
}

// --- LOG STATUS CHANGE ---
function logStatusChange(username, fromStatus, toStatus) {
    if (fromStatus !== toStatus) {
        const msg = `${new Date().toISOString()} - [STATUS] ${username} status changed: ${fromStatus} -> ${toStatus}\n`;
        fs.appendFileSync(logFilePath, msg);
        console.log(msg);
    }
}

// --- AUTOCHECKER LOGIC ---
let autocheckerInterval = null;
let autocheckerActive = false;
function startAutochecker() {
    if (autocheckerInterval) return; // Already running
    autocheckerActive = true;
    io.emit('autoCheckerStatus', { on: true });
    emitStatusUpdate();
    console.log(`[${new Date().toISOString()}] Autochecker started (interval 2 menit)`);
    autocheckerInterval = setInterval(async () => {
        try {
            if (offlineAccounts.length === 0) {
                console.log(`[${new Date().toISOString()}] Autochecker: Tidak ada akun offline, autochecker dihentikan.`);
                stopAutochecker();
                return;
            }
            const accountsToCheck = [...offlineAccounts];
            offlineAccounts = [];
            let newlyLive = [];
            let stillOffline = [];
            let errorAccountsLocal = [];
            
            console.log(`[${new Date().toISOString()}] Autochecker: Checking ${accountsToCheck.length} accounts with rate limiting...`);
            
            for (const username of accountsToCheck) {
                // Selalu buat koneksi baru untuk pengecekan fresh
                if (activeConnections[username]) {
                    try {
                        activeConnections[username].disconnect && activeConnections[username].disconnect();
                    } catch (e) {
                        console.error(`[${new Date().toISOString()}] Autochecker: Error disconnecting old connection for ${username}:`, e);
                    }
                }
                let connection = new WebcastPushConnection(username);
                activeConnections[username] = connection;
                let prevStatus = liveAccounts.includes(username) ? 'online' : 'offline';
                try {
                    // Apply rate limiting before connection
                    await tikTokRateLimiter.canMakeRequest();
                    
                    await connection.connect();
                    if (!liveAccounts.includes(username)) liveAccounts.push(username);
                    newlyLive.push(username);
                    logStatusChange(username, prevStatus, 'online');
                    // PATCH: Pastikan listeners langsung dipasang walaupun listenersAttached sudah true (force re-attach)
                    setupListeners({ conn: connection, uname: username });
                    listenersAttached[username] = true;
                    if (!connectedAccounts.includes(username)) connectedAccounts.push(username);
                    if (!liveDataStore[username]) {
                        initLiveData(username, connection.state || {});
                    }
                    console.log(`[${new Date().toISOString()}] Autochecker: ✅ ${username} is LIVE - Scraping started (monitoring ON)`);
                } catch (err) {
                    if (err.message && err.message.includes("isn't online")) {
                        stillOffline.push(username);
                        logStatusChange(username, prevStatus, 'offline');
                        console.log(`[${new Date().toISOString()}] Autochecker: ⭕ ${username} is OFFLINE`);
                    } else {
                        errorAccountsLocal.push(username);
                        logStatusChange(username, prevStatus, 'error');
                        console.error(`[${new Date().toISOString()}] Autochecker: ❌ ${username} ERROR: ${err.message || err}`);
                    }
                }
            }
            
            // Show rate limiter status
            const rateLimiterStatus = tikTokRateLimiter.getStatus();
            console.log(`[${new Date().toISOString()}] Autochecker: Rate limiter status: ${rateLimiterStatus.requests_made}/${rateLimiterStatus.max_requests} requests, ${rateLimiterStatus.hourly_requests} hourly`);
            
            // Update global offlineAccounts dan errorAccounts
            offlineAccounts = stillOffline;
            errorAccounts = errorAccountsLocal;
            emitStatusUpdate();
            // Emit accountStatusUpdate hanya jika ada akun yang baru live
            if (newlyLive.length > 0) {
                emitAccountStatusUpdate();
            }
            if (offlineAccounts.length === 0) {
                console.log(`[${new Date().toISOString()}] Autochecker: Semua akun sudah live, autochecker dihentikan.`);
                stopAutochecker();
            }
        } catch (e) {
            console.error(`[${new Date().toISOString()}] Autochecker FATAL ERROR:`, e);
        }
    }, 2 * 60 * 1000); // 2 menit (untuk testing)
}
function stopAutochecker() {
    if (autocheckerInterval) {
        clearInterval(autocheckerInterval);
        autocheckerInterval = null;
    }
    autocheckerActive = false;
    io.emit('autoCheckerStatus', { on: false });
    emitStatusUpdate();
}

// --- PATCH: Pastikan monitorLiveInterval dan monitorConnectedInterval selalu didefinisikan ---
let monitorLiveInterval = null;
let monitorConnectedInterval = null;

// Emit status update to all clients
function emitStatusUpdate() {
    io.emit('statusUpdate', {
        autochecker: typeof autocheckerActive !== 'undefined' ? autocheckerActive : false,
        monitoring: typeof isMonitoring !== 'undefined' ? isMonitoring : false,
        // PATCH: scraping harus ON jika isMonitoring true, meskipun connectedAccounts.length === 0
        scraping: typeof isMonitoring !== 'undefined' && isMonitoring,
        autorecover: typeof autorecover !== 'undefined' ? autorecover : false
    });
}

// Emit account status update to all clients
function emitAccountStatusUpdate() {
    io.emit('accountStatusUpdate', {
        online: liveAccounts,
        offline: offlineAccounts,
        error: errorAccounts
    });
}

// --- SESSION ID GENERATION ---
function generateSessionId(username, roomId, timestamp) {
    const time = timestamp.getTime();
    const hash = require('crypto').createHash('md5')
        .update(`${username}-${roomId}-${time}`)
        .digest('hex');
    return `${username}_${time}_${hash.substring(0, 8)}`;
}

// --- UPDATE SESSION TRACKING ---
function updateSessionTracking(username) {
    const session = getCurrentSession(username);
    if (session && session.status === 'live') {
        session.last_update_time = new Date();
        saveLiveDataToFile();
    }
}

// --- MULTI-FACTOR SESSION DETECTION ---
function checkIfSameSession(lastSession, newSessionData) {
    if (!lastSession || lastSession.status !== 'live') {
        return false; // Tidak ada sesi aktif atau sudah finalized
    }
    
    const { roomId, createTime, currentTime, username } = newSessionData;
    
    // Factor 1: Room ID comparison
    const sameRoomId = lastSession.room_id === roomId;
    
    // Factor 2: Time gap analysis
    const maxSessionGap = 10 * 60 * 1000; // 10 menit
    const lastUpdateTime = lastSession.last_update_time || 
                          parseTimestampToDate(lastSession.timestamp_start);
    const timeSinceLastUpdate = currentTime - lastUpdateTime;
    const reasonableTimeGap = timeSinceLastUpdate < maxSessionGap;
    
    // Factor 3: Create time comparison (jika ada)
    let createTimeMatches = true;
    if (createTime && lastSession.create_time) {
        const createTimeDiff = Math.abs(createTime - lastSession.create_time);
        createTimeMatches = createTimeDiff < 60000; // 1 menit tolerance
    }
    
    // Factor 4: Session duration validation
    const sessionStartTime = parseTimestampToDate(lastSession.timestamp_start);
    const sessionDuration = currentTime - sessionStartTime;
    const maxReasonableSessionDuration = 12 * 60 * 60 * 1000; // 12 jam
    const reasonableDuration = sessionDuration < maxReasonableSessionDuration;
    
    // Logging untuk debugging
    console.log(`[SESSION-CHECK] ${username}:`, {
        sameRoomId,
        reasonableTimeGap: reasonableTimeGap ? 'YES' : 'NO',
        timeSinceLastUpdate: Math.round(timeSinceLastUpdate / 1000) + 's',
        createTimeMatches,
        reasonableDuration,
        sessionDuration: Math.round(sessionDuration / 60000) + 'm'
    });
    
    // Decision logic
    if (sameRoomId && reasonableTimeGap && createTimeMatches && reasonableDuration) {
        return true; // Same session
    }
    
    return false; // Different session
}

// Helper function to parse timestamp to Date
function parseTimestampToDate(timestamp) {
    if (!timestamp) return new Date();
    const t = typeof timestamp === 'string' ? timestamp.replace(' ', 'T') : timestamp;
    return new Date(t);
}

// --- END MULTI-FACTOR SESSION DETECTION ---

// --- SESSION ANALYSIS API ---
app.get('/api/session-analysis/:username', (req, res) => {
    const { username } = req.params;
    
    // Analisis untuk satu user
    const sessions = liveDataStore[username] || [];
    const analysis = analyzeUserSessions(username, sessions);
    res.json({ username, analysis });
});

app.get('/api/session-analysis', (req, res) => {
    // Analisis untuk semua user
    const allAnalysis = {};
    for (const user in liveDataStore) {
        const sessions = liveDataStore[user] || [];
        allAnalysis[user] = analyzeUserSessions(user, sessions);
    }
    res.json(allAnalysis);
});

function analyzeUserSessions(username, sessions) {
    if (!Array.isArray(sessions)) return { error: 'Invalid session data' };
    
    const analysis = {
        total_sessions: sessions.length,
        active_sessions: sessions.filter(s => s.status === 'live').length,
        finalized_sessions: sessions.filter(s => s.status === 'finalized').length,
        room_ids: [...new Set(sessions.map(s => s.room_id).filter(Boolean))],
        session_details: [],
        potential_issues: []
    };
    
    // Analisis detail per session
    sessions.forEach((session, index) => {
        const detail = {
            session_number: index + 1,
            session_id: session.session_id,
            room_id: session.room_id,
            status: session.status,
            start_time: session.timestamp_start,
            end_time: session.timestamp_end,
            duration: session.duration,
            peak_viewer: session.peak_viewer,
            total_gifts: session.total_diamond,
            notes_count: session.session_notes?.length || 0
        };
        
        // Deteksi potential issues
        if (session.status === 'live' && session.last_update_time) {
            const timeSinceUpdate = new Date() - session.last_update_time;
            if (timeSinceUpdate > 30 * 60 * 1000) { // 30 menit
                analysis.potential_issues.push({
                    session_id: session.session_id,
                    issue: 'Stale session - no updates for 30+ minutes',
                    last_update: session.last_update_time
                });
            }
        }
        
        analysis.session_details.push(detail);
    });
    
    // Deteksi duplicate room IDs
    const roomIdCounts = {};
    sessions.forEach(s => {
        if (s.room_id) {
            roomIdCounts[s.room_id] = (roomIdCounts[s.room_id] || 0) + 1;
        }
    });
    
    Object.entries(roomIdCounts).forEach(([roomId, count]) => {
        if (count > 1) {
            analysis.potential_issues.push({
                issue: `Room ID ${roomId} used in ${count} sessions`,
                severity: 'warning'
            });
        }
    });
    
    return analysis;
}

// --- RATE LIMITING SOLUTION ---
class RateLimiter {
    constructor(maxRequests = 5, timeWindow = 60000) { // 5 requests per minute
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindow;
        this.requests = [];
        this.rateLimitInfo = null;
        this.lastRateLimitCheck = 0;
        this.maxRequestsPerMinute = RATE_LIMIT_REQUESTS_PER_MINUTE; // From environment
        this.maxRequestsPerHour = RATE_LIMIT_REQUESTS_PER_HOUR; // From environment
        this.requestDelay = RATE_LIMIT_REQUEST_DELAY; // From environment
        this.rateLimitCheckInterval = EULERSTREAM_RATE_LIMIT_CHECK_INTERVAL; // From environment
        this.adaptiveRateLimiting = EULERSTREAM_ADAPTIVE_RATE_LIMITING; // From environment
        this.enabled = RATE_LIMIT_ENABLED; // From environment
    }
    
    async checkRateLimits() {
        // Skip if rate limiting is disabled
        if (!this.enabled) return;
        
        // Check rate limits from EulerStream API every configured interval
        const now = Date.now();
        if (now - this.lastRateLimitCheck > this.rateLimitCheckInterval) {
            try {
                const { TikTokLiveConnection } = require('tiktok-live-connector');
                const connection = new TikTokLiveConnection('temp_user');
                
                if (connection.webClient && connection.webClient.webSigner) {
                    const rateLimitResponse = await connection.webClient.webSigner.webcast.getRateLimits();
                    this.rateLimitInfo = rateLimitResponse.data;
                    this.lastRateLimitCheck = now;
                    
                    if (LOG_ENHANCED_RATE_LIMITING) {
                        console.log('[RATE-LIMIT] EulerStream limits:', {
                            minute: `${this.rateLimitInfo.minute.remaining}/${this.rateLimitInfo.minute.max}`,
                            hour: `${this.rateLimitInfo.hour.remaining}/${this.rateLimitInfo.hour.max}`,
                            day: `${this.rateLimitInfo.day.remaining}/${this.rateLimitInfo.day.max}`
                        });
                    }
                    
                    // Update conservative limits based on remaining capacity (if adaptive enabled)
                    if (this.adaptiveRateLimiting) {
                        if (this.rateLimitInfo.minute.remaining < 5) {
                            this.maxRequestsPerMinute = 2;
                        } else if (this.rateLimitInfo.minute.remaining < 8) {
                            this.maxRequestsPerMinute = 5;
                        }
                        
                        if (this.rateLimitInfo.hour.remaining < 10) {
                            this.maxRequestsPerHour = Math.max(5, Math.floor(this.rateLimitInfo.hour.remaining * 0.8));
                        }
                    }
                }
            } catch (error) {
                if (LOG_ENHANCED_RATE_LIMITING) {
                    console.log('[RATE-LIMIT] Could not check EulerStream limits:', error.message);
                }
            }
        }
    }
    
    async canMakeRequest() {
        // Skip rate limiting if disabled
        if (!this.enabled) {
            return true;
        }
        
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const oneHourAgo = now - 3600000;
        
        // Check current rate limits from EulerStream
        await this.checkRateLimits();
        
        // Clean old requests
        this.requests = this.requests.filter(time => time > oneHourAgo);
        
        // Check if we're hitting EulerStream limits
        if (this.rateLimitInfo) {
            if (this.rateLimitInfo.hour.remaining <= 0) {
                const resetTime = new Date(this.rateLimitInfo.hour.reset_at);
                const waitTime = resetTime.getTime() - now;
                if (waitTime > 0) {
                    console.log(`[RATE-LIMIT] EulerStream hourly limit reached. Waiting ${Math.ceil(waitTime / 60000)} minutes until reset.`);
                    await this.sleep(waitTime);
                    return this.canMakeRequest();
                }
            }
            
            if (this.rateLimitInfo.minute.remaining <= 0) {
                console.log('[RATE-LIMIT] EulerStream minute limit reached. Waiting 60 seconds.');
                await this.sleep(60000);
                return this.canMakeRequest();
            }
        }
        
        // Check minute rate limit
        const recentRequests = this.requests.filter(time => time > oneMinuteAgo);
        if (recentRequests.length >= this.maxRequestsPerMinute) {
            const waitTime = (recentRequests[0] + 60000) - now;
            console.log(`[RATE-LIMIT] Waiting ${Math.round(waitTime/1000)}s for minute limit`);
            await this.sleep(waitTime);
            return this.canMakeRequest();
        }
        
        // Check hour rate limit
        if (this.requests.length >= this.maxRequestsPerHour) {
            const waitTime = (this.requests[0] + 3600000) - now;
            console.log(`[RATE-LIMIT] Waiting ${Math.round(waitTime/1000)}s for hour limit`);
            await this.sleep(waitTime);
            return this.canMakeRequest();
        }
        
        // Add delay between requests
        await this.sleep(this.requestDelay);
        
        // Record this request
        this.requests.push(now);
        return true;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    getStatus() {
        const now = Date.now();
        const recentRequests = this.requests.filter(time => now - time < this.timeWindow);
        const hourlyRequests = this.requests.filter(time => now - time < 3600000);
        
        return {
            requests_made: recentRequests.length,
            max_requests: this.maxRequests,
            time_window_ms: this.timeWindow,
            can_make_request: recentRequests.length < this.maxRequests,
            hourly_requests: hourlyRequests.length,
            max_hourly_requests: this.maxRequestsPerHour,
            eulerstream_limits: this.rateLimitInfo
        };
    }
}

// Global rate limiter instance
const tikTokRateLimiter = new RateLimiter(
    RATE_LIMIT_ENABLED ? RATE_LIMIT_REQUESTS_PER_MINUTE : 100, // Higher limit if disabled
    120000 // 2 minutes window
);

// Helper function for delayed connection
async function connectWithRateLimit(username) {
    await tikTokRateLimiter.canMakeRequest();
    
    let connection = activeConnections[username];
    if (!connection) {
        connection = new WebcastPushConnection(username);
        activeConnections[username] = connection;
    }
    
    try {
        await connection.connect();
        return { success: true, connection };
    } catch (error) {
        if (error.status === 429 || error.message?.includes('rate limit')) {
            console.log(`[RATE-LIMIT] ${username}: Rate limited, will retry later`);
            throw new Error('RATE_LIMITED');
        }
        throw error;
    }
}

// Enhanced batch processing
async function processAccountsBatch(accounts, batchSize = 2) {
    const results = { live: [], offline: [], error: [] };
    
    for (let i = 0; i < accounts.length; i += batchSize) {
        const batch = accounts.slice(i, i + batchSize);
        console.log(`[BATCH] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(accounts.length/batchSize)}: ${batch.join(', ')}`);
        
        for (const username of batch) {
            try {
                const result = await connectWithRateLimit(username);
                if (!liveAccounts.includes(username)) liveAccounts.push(username);
                results.live.push(username);
                console.log(`✅ ${username} is LIVE`);
            } catch (error) {
                if (error.message === 'RATE_LIMITED') {
                    results.error.push(username);
                } else if (error.message && error.message.includes("isn't online")) {
                    results.offline.push(username);
                    console.log(`❌ ${username} is OFFLINE`);
                } else {
                    results.error.push(username);
                    console.log(`⚠️ ${username} ERROR: ${error.message}`);
                }
            }
        }
        
        // Delay between batches
        if (i + batchSize < accounts.length) {
            console.log(`[BATCH] Waiting 10 seconds before next batch...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }
    
    return results;
}

// API to initialize accounts and get current status on page load
app.post('/api/initialize-accounts', (req, res) => {
    // Send current status to help frontend initialize properly
    res.json({
        success: true,
        message: 'Accounts initialized',
        status: {
            autochecker: typeof autocheckerActive !== 'undefined' ? autocheckerActive : false,
            monitoring: typeof isMonitoring !== 'undefined' ? isMonitoring : false,
            scraping: typeof isMonitoring !== 'undefined' && isMonitoring,
            autorecover: typeof autorecover !== 'undefined' ? autorecover : false
        },
        accounts: {
            online: liveAccounts,
            offline: offlineAccounts,
            error: errorAccounts
        },
        liveData: liveDataStore
    });
});
