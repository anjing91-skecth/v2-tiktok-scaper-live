const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { WebcastPushConnection } = require("tiktok-live-connector");
const http = require('http');
const { Server } = require('socket.io');

let autorecover = false;

const app = express();
const PORT = process.env.PORT || 3000;
const accountFilePath = path.join(__dirname, 'account.txt');
const logFilePath = path.join(__dirname, 'scraping.log');
const liveDataFile = path.join(__dirname, 'live_data.json');
const csvFilePath = path.join(__dirname, 'live_data.csv');
const autorecoverFile = path.join(__dirname, 'autorecover.flag');

app.use(cors());
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

// Inisialisasi semua akun sebagai offline saat server pertama kali berjalan
(function initializeAccountsOnServerStart() {
    try {
        const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
        offlineAccounts = [...new Set(usernames)];
        liveAccounts = [];
        connectedAccounts = [];
        errorAccounts = [];
        console.log('All accounts initialized as offline on server start.');
    } catch (e) {
        console.error('Failed to initialize accounts on server start:', e.message);
    }
})();

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
    for (const username of accountsToCheck) {
        let connection = activeConnections[username];
        if (!connection) {
            connection = new WebcastPushConnection(username);
            activeConnections[username] = connection;
        }
        try {
            await connection.connect();
            if (!liveAccounts.includes(username)) liveAccounts.push(username);
            live.push(username);
        } catch (err) {
            if (err.message && err.message.includes("isn't online")) {
                offlineAccounts.push(username);
                offline.push(username);
            } else {
                errorAccounts.push(username);
                error.push(username);
            }
        }
    }
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
    if (liveAccounts.length === 0) {
        return res.status(400).json({ error: 'No live accounts to scrape.' });
    }
    isMonitoring = true;
    autorecover = true;
    fs.writeFileSync(autorecoverFile, 'on');
    liveAccounts.forEach(username => {
        let connection = activeConnections[username];
        // Jangan buat koneksi baru, gunakan hasil check-live
        if (!connection) {
            // Fallback: jika tidak ada, baru buat koneksi
            connection = new WebcastPushConnection(username);
            activeConnections[username] = connection;
        }
        reconnectAttempts[username] = 0;
        // Attach listeners only if not already attached
        if (!listenersAttached[username]) {
            setupListeners({ conn: connection, uname: username });
            listenersAttached[username] = true;
        }
        // Move to connected jika belum
        if (!connectedAccounts.includes(username)) {
            connectedAccounts.push(username);
            const logMessage = `${new Date().toISOString()} - Connected to ${username}'s live stream.\n`;
            fs.appendFileSync(logFilePath, logMessage);
            console.log(logMessage);
        }
        // Jika belum ada data, baru connect dan init data
        if (!liveDataStore[username]) {
            // Jangan connect lagi jika sudah connect dari check-live
            if (!connection.isConnected) {
                connection.connect()
                    .then((state) => {
                        initLiveData(username, state);
                    })
                    .catch((error) => {
                        console.error(`Error connecting to ${username}:`, error.message);
                    });
            } else {
                // Sudah connect, langsung init data
                initLiveData(username, connection.state || {});
            }
        }
    });
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
const liveDataStore = {};
// Tambahkan penyimpanan msgId yang sudah diproses per user
const processedGiftMsgIds = {};

function saveLiveDataToFile() {
    fs.writeFileSync(liveDataFile, JSON.stringify(liveDataStore, null, 2));
    saveLiveDataToCSV(); // Save CSV every time live_data.json is saved
}

function formatDateToGMT7(date) {
    const gmt7 = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    return gmt7.toLocaleString('en-GB', { hour12: false }).replace(',', '');
}

function initLiveData(username, metadata) {
    // Ambil waktu mulai dari metadata TikTok jika ada, fallback ke waktu koneksi
    let timestampStart = null;
    if (metadata && metadata.create_time) {
        // TikTok API: create_time = epoch detik UTC
        timestampStart = formatDateToGMT7(new Date(metadata.create_time * 1000));
    } else {
        timestampStart = formatDateToGMT7(new Date());
    }
    liveDataStore[username] = {
        username,
        room_id: metadata && metadata.roomId ? metadata.roomId : null,
        timestamp_start: timestampStart,
        viewer: 0,
        peak_viewer: 0,
        gifts: [],
        total_diamond: 0,
        leaderboard: {},
        timestamp_end: null,
        duration: null,
        status: 'live' // Tambahkan status
    };
    processedGiftMsgIds[username] = new Set();
    saveLiveDataToFile();
}

function updateLiveData(username, data) {
    if (!liveDataStore[username]) return;
    // TikTok-Live-Connector: viewer count is usually in data.viewerCount
    if (data.viewer !== undefined) {
        liveDataStore[username].viewer = data.viewer;
        if (data.viewer > liveDataStore[username].peak_viewer) {
            liveDataStore[username].peak_viewer = data.viewer;
        }
    }
    if (data.viewerCount !== undefined) {
        liveDataStore[username].viewer = data.viewerCount;
        if (data.viewerCount > liveDataStore[username].peak_viewer) {
            liveDataStore[username].peak_viewer = data.viewerCount;
        }
    }
    if (data.gift) {
        // Gabungkan gift combo jika gift sebelumnya (paling atas) sama persis (gifter, name, timestamp)
        const lastGift = liveDataStore[username].gifts[0];
        if (lastGift &&
            lastGift.gifter === data.gift.gifter &&
            lastGift.name === data.gift.name &&
            lastGift.timestamp === data.gift.timestamp
        ) {
            // Update count dan diamond pada gift paling atas
            lastGift.count += data.gift.count;
            lastGift.diamond += data.gift.diamond;
        } else {
            liveDataStore[username].gifts.unshift(data.gift);
        }
        liveDataStore[username].gifts = liveDataStore[username].gifts.slice(0, 10);
        liveDataStore[username].total_diamond += data.gift.diamond || 0;
        const gifter = data.gift.gifter || 'unknown';
        if (!liveDataStore[username].leaderboard[gifter]) liveDataStore[username].leaderboard[gifter] = 0;
        liveDataStore[username].leaderboard[gifter] += data.gift.diamond || 0;
    }
    saveLiveDataToFile();
    emitLiveDataUpdate(username);
}

function finalizeLiveData(username) {
    if (!liveDataStore[username]) return;
    liveDataStore[username].timestamp_end = formatDateToGMT7(new Date());
    const start = new Date(liveDataStore[username].timestamp_start.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));
    const end = new Date();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    liveDataStore[username].duration = `${minutes}m ${seconds}s`;
    liveDataStore[username].status = 'finalized'; // Update status
    saveLiveDataToFile();
    emitLiveDataFinalize(username);
    saveLiveDataToCSV(); // Save CSV on finalize
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

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
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
        const data = liveDataStore[username];
        if (!data.room_id) continue; // skip if no room id
        // Format tanggal dan jam dari timestamp_start jika ada, else '-'
        const tgl = data.timestamp_start || '-';
        const row = [
            tgl,
            data.room_id,
            data.username,
            data.duration || '-',
            data.peak_viewer || 0,
            data.total_diamond || 0
        ];
        // Top spender
        const sorted = Object.entries(data.leaderboard||{}).sort((a,b)=>b[1]-a[1]);
        for (let i=0; i<10; i++) {
            if (sorted[i]) {
                row.push(`${sorted[i][0]}(${sorted[i][1]})`);
            } else {
                row.push('');
            }
        }
        rows.push(row.join('|'));
    }
    fs.writeFileSync(csvFilePath, rows.join('\n'));
}

// Endpoint for save and download CSV
app.get('/api/save-and-download-csv', (req, res) => {
    saveLiveDataToCSV();
    res.download(csvFilePath, 'live_data.csv');
});

// Status endpoint untuk frontend
app.get('/api/status', (req, res) => {
    res.json({
        autochecker: typeof autocheckerActive !== 'undefined' ? autocheckerActive : false,
        monitoring: typeof isMonitoring !== 'undefined' ? isMonitoring : false,
        scraping: typeof isMonitoring !== 'undefined' && isMonitoring && connectedAccounts.length > 0,
        autorecover: typeof autorecover !== 'undefined' ? autorecover : false
    });
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
        app.handle({ method: 'POST', url: '/api/start-scraping-all' }, { json: () => {} });
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
        }
    });
}

// --- AUTOCHECKER LOGIC ---
let autocheckerInterval = null;
let autocheckerActive = false;
function startAutochecker() {
    if (autocheckerInterval) return; // Already running
    autocheckerActive = true;
    io.emit('autoCheckerStatus', { on: true });
    autocheckerInterval = setInterval(async () => {
        if (offlineAccounts.length === 0) {
            stopAutochecker();
            return;
        }
        let newlyLive = [];
        for (const username of [...offlineAccounts]) {
            let connection = activeConnections[username];
            if (!connection) {
                connection = new WebcastPushConnection(username);
                activeConnections[username] = connection;
            }
            try {
                await connection.connect();
                if (!liveAccounts.includes(username)) liveAccounts.push(username);
                // Remove from offline
                offlineAccounts = offlineAccounts.filter(u => u !== username);
                newlyLive.push(username);
                // If monitoring/scraping is active, auto-attach listeners and start scraping for this account
                if (isMonitoring && !listenersAttached[username]) {
                    setupListeners({ conn: connection, uname: username });
                    listenersAttached[username] = true;
                    if (!connectedAccounts.includes(username)) connectedAccounts.push(username);
                    // Optionally, init live data if not present
                    if (!liveDataStore[username]) {
                        initLiveData(username, connection.state || {});
                    }
                }
                io.emit('autoCheckerStatus', { on: true });
            } catch (err) {
                // Remain offline
            }
        }
        // Always broadcast status update
        io.emit('statusUpdate', {
            autochecker: autocheckerActive,
            monitoring: isMonitoring,
            scraping: isMonitoring, // If you have a separate scraping flag, use it
            autorecover: autorecover
        });
        // If all are live, stop autochecker
        if (offlineAccounts.length === 0) {
            stopAutochecker();
        }
    }, 60 * 1000); // 1 minute
}
function stopAutochecker() {
    if (autocheckerInterval) {
        clearInterval(autocheckerInterval);
        autocheckerInterval = null;
    }
    autocheckerActive = false;
    io.emit('autoCheckerStatus', { on: false });
    io.emit('statusUpdate', {
        autochecker: autocheckerActive,
        monitoring: isMonitoring,
        scraping: isMonitoring, // If you have a separate scraping flag, use it
        autorecover: autorecover
    });
}
