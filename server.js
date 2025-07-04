const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
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
const RATE_LIMIT_REQUESTS_PER_DELAY = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_DELAY) || 1000;

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

// Supabase Backup Optimization Configuration
const SUPABASE_BACKUP_ENABLED = process.env.SUPABASE_BACKUP_ENABLED !== 'false';
const SUPABASE_BACKUP_INTERVAL = parseInt(process.env.SUPABASE_BACKUP_INTERVAL) || 300000; // 5 minutes
const SUPABASE_BACKUP_BATCH_SIZE = parseInt(process.env.SUPABASE_BACKUP_BATCH_SIZE) || 50; // max sessions per batch
const SUPABASE_BACKUP_DEBOUNCE_DELAY = parseInt(process.env.SUPABASE_BACKUP_DEBOUNCE_DELAY) || 30000; // 30 seconds
const SUPABASE_BACKUP_FORCE_INTERVAL = parseInt(process.env.SUPABASE_BACKUP_FORCE_INTERVAL) || 1800000; // 30 minutes

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

// Initialize HTTP server and Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Clear log file on startup
fs.writeFileSync(logFilePath, '');

// Load and mount routes
const downloadDataRouter = require('./routes/downloadData');
downloadDataRouter.injectState({
    saveLiveDataToCSV: () => saveLiveDataToCSV(),
    csvFilePath: csvFilePath
});
app.use('/api', downloadDataRouter.router);

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

// Supabase Backup Optimization State
let lastSupabaseBackup = 0;
let pendingSupabaseBackup = false;
let supabaseBackupDebounceTimer = null;
let lastSupabaseDataHash = null;

// --- SOCKET.IO SETUP ---
// const httpServer = http.createServer(app);
// const io = new Server(httpServer, {
//     cors: { origin: '*', methods: ['GET', 'POST'] }
// });
// --- END SOCKET.IO SETUP ---

// Initialize Supabase and load data on server start
async function initializeServer() {
    try {
        // Initialize Supabase
        supabaseClient.initializeSupabase();
        
        // Load data from Supabase first
        if (supabaseClient.useSupabase()) {
            console.log('🔄 Loading data from Supabase...');
            const supabaseData = await supabaseClient.loadDataFromSupabase();
            if (Object.keys(supabaseData).length > 0) {
                Object.assign(liveDataStore, supabaseData);
                console.log(`✅ Loaded ${Object.keys(supabaseData).length} users from Supabase`);
            }
            
            // Display Supabase backup configuration
            console.log('🔧 Supabase Backup Configuration:');
            console.log(`   • Enabled: ${SUPABASE_BACKUP_ENABLED}`);
            console.log(`   • Interval: ${SUPABASE_BACKUP_INTERVAL/1000/60} minutes`);
            console.log(`   • Debounce: ${SUPABASE_BACKUP_DEBOUNCE_DELAY/1000} seconds`);
            console.log(`   • Batch Size: ${SUPABASE_BACKUP_BATCH_SIZE} sessions`);
            console.log(`   • Force Interval: ${SUPABASE_BACKUP_FORCE_INTERVAL/1000/60} minutes`);
        }
        
        // Load from local file as fallback
        if (fs.existsSync(liveDataFile)) {
            try {
                const localData = JSON.parse(fs.readFileSync(liveDataFile, 'utf-8'));
                // Merge local data dengan Supabase data
                Object.assign(liveDataStore, localData);
                console.log('📄 Local data loaded as backup');
            } catch (e) {
                console.error('❌ Failed to load local data:', e.message);
            }
        }
        
        // Initialize accounts as offline
        const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
        offlineAccounts = [...new Set(usernames)];
        liveAccounts = [];
        connectedAccounts = [];
        errorAccounts = [];
        console.log(`📋 All ${usernames.length} accounts initialized as offline on server start.`);
        
        // Load autorecover status from Supabase first, then file as fallback
        console.log('🔄 Loading autorecover status...');
        
        // Try Supabase first
        if (supabaseClient.useSupabase()) {
            const supabaseAutorecoverFlag = await supabaseClient.getSupabaseFlag('autorecover');
            if (supabaseAutorecoverFlag !== null) {
                autorecover = supabaseAutorecoverFlag === 'true' || supabaseAutorecoverFlag === true;
                console.log(`📦 Autorecover status from Supabase: ${autorecover ? 'Enabled' : 'Disabled'}`);
            } else {
                console.log('ℹ️ No autorecover flag found in Supabase');
            }
        }
        
        // If not found in Supabase, try local file as fallback
        if (!supabaseClient.useSupabase() || await supabaseClient.getSupabaseFlag('autorecover') === null) {
            if (fs.existsSync(autorecoverFile)) {
                autorecover = true;
                console.log('� Autorecover flag detected from local file - Auto-recovery enabled');
                
                // Migrate to Supabase if available
                if (supabaseClient.useSupabase()) {
                    await supabaseClient.setSupabaseFlag('autorecover', 'true');
                    console.log('📦 Migrated autorecover flag to Supabase');
                }
            } else {
                autorecover = false;
                console.log('ℹ️ No autorecover flag found - Auto-recovery disabled');
            }
        }
        
        // Display comprehensive system status
        console.log('\n🚀 System Status Summary:');
        console.log(`   • Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`   • Port: ${PORT}`);
        console.log(`   • Rate Limiting: ${RATE_LIMIT_ENABLED ? 'Enabled' : 'Disabled'} (${RATE_LIMIT_REQUESTS_PER_MINUTE} req/min)`);
        console.log(`   • Session Detection: ${SESSION_DETECTION_ENABLED ? 'Enabled' : 'Disabled'}`);
        console.log(`   • Auto-Recovery: ${autorecover ? 'Enabled' : 'Disabled'}`);
        console.log(`   • Supabase Backup: ${SUPABASE_BACKUP_ENABLED ? 'Enabled' : 'Disabled'}`);
        console.log(`   • Auto-Checker: ${AUTO_CHECKER_ENABLED ? 'Enabled' : 'Disabled'} (${AUTO_CHECKER_INTERVAL/1000/60} min)`);
        console.log(`   • Total Accounts: ${usernames.length}`);
        console.log(`   • Existing Sessions: ${Object.keys(liveDataStore).length}`);
        console.log('');
        
        // Log recovery status after system check
        if (autorecover) {
            console.log('🔄 Recovery Process Status:');
            console.log('   • System will automatically restart monitoring after updates');
            console.log('   • All sessions will be restored from Supabase/local storage');
            console.log('   • Account checking will resume with rate limiting');
            console.log('');
        }
        
        // Migrate data format if needed
        migrateLiveDataStoreFormat();
        
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
app.post('/api/start-scraping-all', async (req, res) => {
    // PATCH: Jangan return error jika liveAccounts.length === 0
    // isMonitoring harus tetap true meskipun tidak ada akun live
    isMonitoring = true;
    autorecover = true;
    
    // Save autorecover flag to both Supabase and file
    if (supabaseClient.useSupabase()) {
        await supabaseClient.setSupabaseFlag('autorecover', 'true');
        console.log('📦 Autorecover flag saved to Supabase');
    }
    fs.writeFileSync(autorecoverFile, 'on');
    console.log('📄 Autorecover flag saved to local file');
    
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
app.post('/api/stop-monitoring', async (req, res) => {
    isMonitoring = false;
    autorecover = false;
    
    // Remove autorecover flag from both Supabase and file
    if (supabaseClient.useSupabase()) {
        await supabaseClient.deleteSupabaseFlag('autorecover');
        console.log('📦 Autorecover flag removed from Supabase');
    }
    if (fs.existsSync(autorecoverFile)) {
        fs.unlinkSync(autorecoverFile);
        console.log('📄 Autorecover flag removed from local file');
    }
    
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

// --- FLAG MANAGEMENT API ---
// Get flag status
app.get('/api/flag/:flagName', async (req, res) => {
    const { flagName } = req.params;
    
    try {
        let value = null;
        
        // Try Supabase first
        if (supabaseClient.useSupabase()) {
            value = await supabaseClient.getSupabaseFlag(flagName);
        }
        
        // If not found in Supabase, try local file for specific flags
        if (value === null && flagName === 'autorecover') {
            value = fs.existsSync(autorecoverFile) ? 'true' : 'false';
        }
        
        res.json({ 
            flag: flagName, 
            value: value,
            source: value !== null ? (supabaseClient.useSupabase() ? 'supabase' : 'file') : 'none'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set flag
app.post('/api/flag/:flagName', async (req, res) => {
    const { flagName } = req.params;
    const { value } = req.body;
    
    try {
        let success = false;
        
        // Save to Supabase if available
        if (supabaseClient.useSupabase()) {
            success = await supabaseClient.setSupabaseFlag(flagName, value);
        }
        
        // Handle specific flags with file fallback
        if (flagName === 'autorecover') {
            if (value === 'true' || value === true) {
                fs.writeFileSync(autorecoverFile, 'on');
                autorecover = true;
            } else {
                if (fs.existsSync(autorecoverFile)) {
                    fs.unlinkSync(autorecoverFile);
                }
                autorecover = false;
            }
            success = true;
        }
        
        res.json({ 
            flag: flagName, 
            value: value,
            success: success,
            saved_to: supabaseClient.useSupabase() ? 'supabase_and_file' : 'file_only'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete flag
app.delete('/api/flag/:flagName', async (req, res) => {
    const { flagName } = req.params;
    
    try {
        let success = false;
        
        // Delete from Supabase if available
        if (supabaseClient.useSupabase()) {
            success = await supabaseClient.deleteSupabaseFlag(flagName);
        }
        
        // Handle specific flags with file cleanup
        if (flagName === 'autorecover') {
            if (fs.existsSync(autorecoverFile)) {
                fs.unlinkSync(autorecoverFile);
            }
            autorecover = false;
            success = true;
        }
        
        res.json({ 
            flag: flagName, 
            deleted: success,
            cleaned_from: supabaseClient.useSupabase() ? 'supabase_and_file' : 'file_only'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Live data storage
// Tambahkan penyimpanan msgId yang sudah diproses per user
const processedGiftMsgIds = {};

function saveLiveDataToFile() {
    fs.writeFileSync(liveDataFile, JSON.stringify(liveDataStore, null, 2));
    saveLiveDataToCSV(); // Save CSV every time live_data.json is saved
    
    // NEW: Optimized auto-backup to Supabase (with batching, debouncing, deduplication)
    scheduleSupabaseBackup(false);
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
    
    // Defensive: Always extract Room ID as string, fallback to null
    let roomId = null;
    if (metadata && (metadata.roomId || metadata.room_id)) {
        roomId = String(metadata.roomId || metadata.room_id);
    }
    if (!roomId) {
        console.warn(`[SESSION-INIT] ${username}: WARNING - Room ID missing in metadata!`);
    }
    // Extra logging for debugging
    console.log(`[SESSION-INIT] ${username}: Room ID extracted:`, roomId, '| Metadata:', JSON.stringify(metadata));
    const currentTime = new Date();
    
    // Get existing sessions
    let sessions = liveDataStore[username] || [];
    let lastSession = sessions[sessions.length - 1];
    
    console.log(`[SESSION-INIT] ${username}: Checking session for Room ID: ${roomId}`);
    console.log(`[SESSION-INIT] ${username}: Existing sessions: ${sessions.length}`);
    if (lastSession) {
        console.log(`[SESSION-INIT] ${username}: Last session - Room: ${lastSession.room_id}, Status: ${lastSession.status}`);
    }
    
    // --- MULTI-FACTOR SESSION DETECTION ---
    const isSameSession = checkIfSameSession(lastSession, {
        roomId,
        createTime,
        currentTime,
        username
    });
    
    if (isSameSession) {
        // Lanjutkan sesi yang sama
        console.log(`[SESSION] ✅ Continuing existing session for ${username} (Room: ${roomId})`);
        return;
    }
    
    // Jika ada sesi live aktif yang berbeda, finalize dulu
    if (lastSession && lastSession.status === 'live') {
        console.log(`[SESSION] 🔄 Finalizing previous session for ${username} (New session detected)`);
        console.log(`[SESSION] Previous: Room ${lastSession.room_id} → New: Room ${roomId}`);
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
    
    if (!Array.isArray(liveDataStore[username])) liveDataStore[username] = [];
    liveDataStore[username].push(newSession);
    processedGiftMsgIds[username] = new Set();
    
    console.log(`[SESSION] 🎉 NEW SESSION CREATED for ${username}:`);
    console.log(`   • Session ID: ${newSession.session_id}`);
    console.log(`   • Room ID: ${roomId}`);
    console.log(`   • Start Time: ${timestampStart}`);
    console.log(`   • Total Sessions: ${liveDataStore[username].length}`);
    console.log(`   • Status: ${newSession.status}`);
    
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

// --- SUPABASE BACKUP API ENDPOINTS ---
app.post('/api/force-supabase-backup', async (req, res) => {
    try {
        if (!supabaseClient.useSupabase()) {
            return res.status(400).json({ error: 'Supabase not configured' });
        }
        console.log('🚀 Manual Supabase backup requested');
        const success = await performOptimizedSupabaseBackup(true);
        if (success) {
            res.json({ 
                message: 'Manual Supabase backup completed successfully',
                timestamp: new Date().toISOString(),
                forced: true
            });
        } else {
            res.status(500).json({ error: 'Backup failed' });
        }
    } catch (error) {
        console.error('❌ Manual backup error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/supabase-status', (req, res) => {
    const now = Date.now();
    const timeSinceLastBackup = now - lastSupabaseBackup;
    
    res.json({
        supabase: supabaseClient.getSupabaseStatus(),
        backup: {
            enabled: SUPABASE_BACKUP_ENABLED,
            lastBackup: lastSupabaseBackup ? new Date(lastSupabaseBackup).toISOString() : null,
            timeSinceLastBackup: timeSinceLastBackup,
            timeSinceLastBackupMinutes: Math.round(timeSinceLastBackup / 1000 / 60),
            pendingBackup: pendingSupabaseBackup,
            interval: SUPABASE_BACKUP_INTERVAL,
            debounceDelay: SUPABASE_BACKUP_DEBOUNCE_DELAY,
            batchSize: SUPABASE_BACKUP_BATCH_SIZE
        },
        optimization: {
            lastDataHash: lastSupabaseDataHash ? lastSupabaseDataHash.substring(0, 8) + '...' : null,
            totalSessions: Object.values(liveDataStore).reduce((total, sessions) => 
                total + (Array.isArray(sessions) ? sessions.length : 0), 0)
        }
    });
});

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
    
    // PRIMARY RULE: Room ID MUST match for same session
    // If Room ID is different, it's ALWAYS a new session
    if (!roomId || !lastSession.room_id || lastSession.room_id !== roomId) {
        console.log(`[SESSION-CHECK] ${username}: DIFFERENT Room ID - Creating NEW session`);
        console.log(`   • Previous Room ID: ${lastSession.room_id}`);
        console.log(`   • New Room ID: ${roomId}`);
        return false; // Different room = new session
    }
    
    // If Room ID is the same, check other factors
    const sameRoomId = true; // Already confirmed above
    
    // Factor 2: Time gap analysis (only for same room ID)
    const maxSessionGap = 30 * 60 * 1000; // 30 menit (increased tolerance)
    const lastUpdateTime = lastSession.last_update_time || 
                          parseTimestampToDate(lastSession.timestamp_start);
    const timeSinceLastUpdate = currentTime - lastUpdateTime;
    const reasonableTimeGap = timeSinceLastUpdate < maxSessionGap;
    
    // Factor 3: Session duration validation
    const sessionStartTime = parseTimestampToDate(lastSession.timestamp_start);
    const sessionDuration = currentTime - sessionStartTime;
    const maxReasonableSessionDuration = 24 * 60 * 60 * 1000; // 24 jam (increased tolerance)
    const reasonableDuration = sessionDuration < maxReasonableSessionDuration;
    
    // Logging untuk debugging
    console.log(`[SESSION-CHECK] ${username}: SAME Room ID - Checking continuation`);
    console.log(`   • Room ID: ${roomId}`);
    console.log(`   • Time since last update: ${Math.round(timeSinceLastUpdate / 1000)}s`);
    console.log(`   • Session duration: ${Math.round(sessionDuration / 60000)}m`);
    console.log(`   • Reasonable time gap: ${reasonableTimeGap ? 'YES' : 'NO'}`);
    console.log(`   • Reasonable duration: ${reasonableDuration ? 'YES' : 'NO'}`);
    
    // Decision logic for same room ID
    if (reasonableTimeGap && reasonableDuration) {
        console.log(`[SESSION-CHECK] ${username}: CONTINUING existing session`);
        return true; // Same session
    } else {
        console.log(`[SESSION-CHECK] ${username}: Time gap/duration exceeded - Creating NEW session`);
        return false; // New session even with same room ID
    }
}

// Helper function to parse timestamp to Date
function parseTimestampToDate(timestamp) {
    if (!timestamp) return new Date();
    const t = typeof timestamp === 'string' ? timestamp.replace(' ', 'T') : timestamp;
    return new Date(t);
}

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

// --- SESSION COUNT ANALYSIS API ---
app.get('/api/session-count/:username', (req, res) => {
    const { username } = req.params;
    const { date } = req.query; // Format: YYYY-MM-DD
    
    const sessions = liveDataStore[username] || [];
    if (!Array.isArray(sessions)) {
        return res.json({ error: 'No sessions found for user' });
    }
    
    let filteredSessions = sessions;
    
    // Filter by date if provided
    if (date) {
        filteredSessions = sessions.filter(session => {
            if (!session.timestamp_start) return false;
            const sessionDate = session.timestamp_start.split(' ')[0]; // Get DD/MM/YYYY part
            const [day, month, year] = sessionDate.split('/');
            const sessionDateFormatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            return sessionDateFormatted === date;
        });
    }
    
    const analysis = {
        username,
        date: date || 'all',
        total_sessions: filteredSessions.length,
        active_sessions: filteredSessions.filter(s => s.status === 'live').length,
        finalized_sessions: filteredSessions.filter(s => s.status === 'finalized').length,
        sessions: filteredSessions.map(session => ({
            session_id: session.session_id,
            room_id: session.room_id,
            start_time: session.timestamp_start,
            end_time: session.timestamp_end,
            duration: session.duration,
            status: session.status,
            peak_viewer: session.peak_viewer,
            total_diamond: session.total_diamond
        }))
    };
    
    res.json(analysis);
});

app.get('/api/daily-session-summary', (req, res) => {
    const { date } = req.query; // Format: YYYY-MM-DD
    const summary = {};
    
    for (const username in liveDataStore) {
        const sessions = liveDataStore[username] || [];
        if (!Array.isArray(sessions)) continue;
        
        let filteredSessions = sessions;
        
        // Filter by date if provided
        if (date) {
            filteredSessions = sessions.filter(session => {
                if (!session.timestamp_start) return false;
                const sessionDate = session.timestamp_start.split(' ')[0]; // Get DD/MM/YYYY part
                const [day, month, year] = sessionDate.split('/');
                const sessionDateFormatted = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                return sessionDateFormatted === date;
            });
        }
        
        if (filteredSessions.length > 0) {
            summary[username] = {
                total_sessions: filteredSessions.length,
                active_sessions: filteredSessions.filter(s => s.status === 'live').length,
                finalized_sessions: filteredSessions.filter(s => s.status === 'finalized').length,
                room_ids: [...new Set(filteredSessions.map(s => s.room_id).filter(Boolean))],
                total_diamonds: filteredSessions.reduce((sum, s) => sum + (s.total_diamond || 0), 0),
                peak_viewers: Math.max(...filteredSessions.map(s => s.peak_viewer || 0))
            };
        }
    }
    
    res.json({
        date: date || 'all',
        users: Object.keys(summary).length,
        total_sessions: Object.values(summary).reduce((sum, user) => sum + user.total_sessions, 0),
        summary
    });
});

// CSV Export Function
function saveLiveDataToCSV() {
    if (!process.env.CSV_EXPORT_ENABLED || process.env.CSV_EXPORT_ENABLED === 'false') {
        return; // Skip CSV export if disabled
    }
    
    try {
        const csvData = [];
        
        // CSV headers
        csvData.push([
            'username',
            'session_id',
            'room_id',
            'timestamp_start',
            'timestamp_end',
            'duration',
            'duration_monitored',
            'status',
            'viewer_current',
            'peak_viewer',
            'total_diamond',
            'connection_attempts',
            'session_notes_count'
        ].join(','));
        
        // Process each user's sessions
        for (const username in liveDataStore) {
            const userSessions = liveDataStore[username];
            if (Array.isArray(userSessions)) {
                userSessions.forEach(session => {
                    const row = [
                        username,
                        session.session_id || '',
                        session.room_id || '',
                        session.timestamp_start || '',
                        session.timestamp_end || '',
                        session.duration || '',
                        session.duration_monitored || '',
                        session.status || '',
                        session.viewer || 0,
                        session.peak_viewer || 0,
                        session.total_diamond || 0,
                        session.connection_attempts || 0,
                        session.session_notes?.length || 0
                    ];
                    csvData.push(row.join(','));
                });
            } else if (typeof userSessions === 'object' && userSessions !== null) {
                // Handle legacy single session format
                const session = userSessions;
                const row = [
                    username,
                    session.session_id || '',
                    session.room_id || '',
                    session.timestamp_start || '',
                    session.timestamp_end || '',
                    session.duration || '',
                    session.duration_monitored || '',
                    session.status || '',
                    session.viewer || 0,
                    session.peak_viewer || 0,
                    session.total_diamond || 0,
                    session.connection_attempts || 0,
                    session.session_notes?.length || 0
                ];
                csvData.push(row.join(','));
            }
        }
        
        // Write CSV file
        const csvContent = csvData.join('\n');
        fs.writeFileSync(csvFilePath, csvContent);
        console.log(`📊 CSV exported: ${csvData.length - 1} session records`);
        
    } catch (error) {
        console.error('❌ Failed to save CSV:', error.message);
    }
}

// --- RATE LIMITER ---
const tikTokRateLimiter = {
    requests: [],
    hourlyRequests: [],
    maxRequestsPerMinute: RATE_LIMIT_REQUESTS_PER_MINUTE,
    maxRequestsPerHour: RATE_LIMIT_REQUESTS_PER_HOUR,
    requestDelay: RATE_LIMIT_REQUESTS_PER_DELAY,
    
    async canMakeRequest() {
        const now = Date.now();
        
        // Clean old requests (older than 1 minute)
        this.requests = this.requests.filter(time => now - time < 60000);
        
        // Clean old hourly requests (older than 1 hour)
        this.hourlyRequests = this.hourlyRequests.filter(time => now - time < 3600000);
        
        // Check if we can make a request
        if (this.requests.length >= this.maxRequestsPerMinute) {
            const waitTime = 60000 - (now - this.requests[0]);
            console.log(`⏱️  Rate limit reached, waiting ${Math.ceil(waitTime/1000)}s`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.canMakeRequest();
        }
        
        if (this.hourlyRequests.length >= this.maxRequestsPerHour) {
            const waitTime = 3600000 - (now - this.hourlyRequests[0]);
            console.log(`⏱️  Hourly rate limit reached, waiting ${Math.ceil(waitTime/1000/60)}m`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.canMakeRequest();
        }
        
        // Record the request
        this.requests.push(now);
        this.hourlyRequests.push(now);
        
        // Apply delay between requests
        if (this.requestDelay > 0) {
            await new Promise(resolve => setTimeout(resolve, this.requestDelay));
        }
        
        return true;
    },
    
    getStatus() {
        const now = Date.now();
        const recentRequests = this.requests.filter(time => now - time < 60000);
        const recentHourlyRequests = this.hourlyRequests.filter(time => now - time < 3600000);
        
        return {
            requests_made: recentRequests.length,
            max_requests: this.maxRequestsPerMinute,
            hourly_requests: recentHourlyRequests.length,
            max_hourly_requests: this.maxRequestsPerHour,
            delay_ms: this.requestDelay
        };
    }
};

// --- SUPABASE BACKUP FUNCTIONS ---
function scheduleSupabaseBackup(forced = false) {
    if (!SUPABASE_BACKUP_ENABLED || !supabaseClient.useSupabase()) {
        return;
    }
    
    const now = Date.now();
    
    // Clear existing debounce timer
    if (supabaseBackupDebounceTimer) {
        clearTimeout(supabaseBackupDebounceTimer);
    }
    
    // Force backup immediately if requested
    if (forced) {
        console.log('🚀 Forcing immediate Supabase backup');
        performOptimizedSupabaseBackup(true);
        return;
    }
    
    // Check if enough time has passed since last backup
    const timeSinceLastBackup = now - lastSupabaseBackup;
    const shouldForceBackup = timeSinceLastBackup > SUPABASE_BACKUP_FORCE_INTERVAL;
    
    if (shouldForceBackup) {
        console.log('⏰ Force backup interval reached, scheduling immediate backup');
        performOptimizedSupabaseBackup(true);
        return;
    }
    
    // Set debounce timer for regular backup
    supabaseBackupDebounceTimer = setTimeout(() => {
        performOptimizedSupabaseBackup(false);
    }, SUPABASE_BACKUP_DEBOUNCE_DELAY);
    
    console.log(`📅 Supabase backup scheduled in ${SUPABASE_BACKUP_DEBOUNCE_DELAY/1000}s`);
}

async function performOptimizedSupabaseBackup(forced = false) {
    if (!SUPABASE_BACKUP_ENABLED || !supabaseClient.useSupabase()) {
        return false;
    }
    
    if (pendingSupabaseBackup && !forced) {
        console.log('⏳ Backup already in progress, skipping');
        return false;
    }
    
    try {
        pendingSupabaseBackup = true;
        const now = Date.now();
        
        // Generate data hash for deduplication
        const dataString = JSON.stringify(liveDataStore);
        const currentDataHash = require('crypto').createHash('md5').update(dataString).digest('hex');
        
        // Skip backup if data hasn't changed (unless forced)
        if (!forced && currentDataHash === lastSupabaseDataHash) {
            console.log('🔄 No data changes detected, skipping backup');
            pendingSupabaseBackup = false;
            return false;
        }
        
        // Prepare sessions for backup (batching)
        const allSessions = [];
        for (const username in liveDataStore) {
            const userSessions = liveDataStore[username];
            if (Array.isArray(userSessions)) {
                userSessions.forEach(session => {
                    allSessions.push({
                        username,
                        session_data: session,
                        last_updated: now
                    });
                });
            }
        }
        
        // Backup in batches
        const totalSessions = allSessions.length;
        let backedUpSessions = 0;
        
        for (let i = 0; i < allSessions.length; i += SUPABASE_BACKUP_BATCH_SIZE) {
            const batch = allSessions.slice(i, i + SUPABASE_BACKUP_BATCH_SIZE);
            
            try {
                const success = await supabaseClient.saveDataToSupabase(
                    Object.fromEntries(batch.map(item => [item.username, item.session_data]))
                );
                
                if (success) {
                    backedUpSessions += batch.length;
                } else {
                    console.error(`❌ Failed to backup batch ${Math.floor(i/SUPABASE_BACKUP_BATCH_SIZE) + 1}`);
                }
            } catch (error) {
                console.error(`❌ Error backing up batch ${Math.floor(i/SUPABASE_BACKUP_BATCH_SIZE) + 1}:`, error.message);
            }
            
            // Small delay between batches to avoid overwhelming Supabase
            if (i + SUPABASE_BACKUP_BATCH_SIZE < allSessions.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Update backup tracking
        lastSupabaseBackup = now;
        lastSupabaseDataHash = currentDataHash;
        
        console.log(`✅ Supabase backup completed: ${backedUpSessions}/${totalSessions} sessions`);
        console.log(`📊 Backup stats: ${forced ? 'FORCED' : 'SCHEDULED'} | Hash: ${currentDataHash.substring(0, 8)}...`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Supabase backup failed:', error.message);
        return false;
    } finally {
        pendingSupabaseBackup = false;
    }
}

// Start the server
httpServer.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend: http://localhost:${PORT}`);
    console.log(`💻 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Start periodic Supabase backup if enabled
    if (SUPABASE_BACKUP_ENABLED && supabaseClient.useSupabase()) {
        setInterval(() => {
            scheduleSupabaseBackup(false);
        }, SUPABASE_BACKUP_INTERVAL);
        console.log(`📦 Periodic Supabase backup enabled (${SUPABASE_BACKUP_INTERVAL/1000/60}min intervals)`);
    }
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    
    // Save final backup
    if (SUPABASE_BACKUP_ENABLED && supabaseClient.useSupabase()) {
        console.log('💾 Performing final backup...');
        performOptimizedSupabaseBackup(true).then(() => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    
    // Save final backup
    if (SUPABASE_BACKUP_ENABLED && supabaseClient.useSupabase()) {
        console.log('💾 Performing final backup...');
        performOptimizedSupabaseBackup(true).then(() => {
            process.exit(0);
        });
    } else {
        process.exit(0);
    }
});
