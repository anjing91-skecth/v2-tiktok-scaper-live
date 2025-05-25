const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { WebcastPushConnection } = require("tiktok-live-connector");
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;
const accountFilePath = path.join(__dirname, 'account.txt');
const logFilePath = path.join(__dirname, 'scraping.log');
const liveDataFile = path.join(__dirname, 'live_data.json');
const csvFilePath = path.join(__dirname, 'live_data.csv');

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

// Update check-live to only check offline accounts
app.post('/api/check-live', async (req, res) => {
    const accountsToCheck = [...offlineAccounts]; // Only check offline accounts
    offlineAccounts = [];

    for (const username of accountsToCheck) {
        const connection = new WebcastPushConnection(username);
        try {
            await connection.connect();
            liveAccounts.push(username);
            console.log(`${username} is live.`);
        } catch (error) {
            if (error.message && error.message.includes("isn't online")) {
                offlineAccounts.push(username);
                console.log(`${username} is offline.`);
            } else {
                errorAccounts.push(username);
                console.error(`Error checking ${username}:`, error.message);
            }
        }
    }

    res.json({ live: liveAccounts, offline: offlineAccounts, error: errorAccounts });
});

// Ensure monitoring starts as off
let isMonitoring = false;

// Monitor live accounts for changes only if monitoring is active
function monitorLiveAccounts() {
    setInterval(() => {
        if (!isMonitoring) return; // Skip jika monitoring tidak aktif

        // Hanya cek akun offline yang belum terhubung
        for (let i = offlineAccounts.length - 1; i >= 0; i--) {
            const username = offlineAccounts[i];
            console.log(`Checking if ${username} is now live...`);
            
            try {
                const connection = new WebcastPushConnection(username);
                connection.connect()
                    .then(() => {
                        // Akun sekarang live, pindahkan dari offline ke live
                        offlineAccounts.splice(i, 1);
                        if (!liveAccounts.includes(username)) {
                            liveAccounts.push(username);
                        }
                        console.log(`${username} is now live. Added to live accounts list.`);
                        
                        // Connect jika monitoring aktif
                        if (isMonitoring && !connectedAccounts.includes(username)) {
                            // Buat koneksi baru untuk monitoring
                            const monitorConnection = new WebcastPushConnection(username);
                            monitorConnection.connect()
                                .then((state) => {
                                    connectedAccounts.push(username);
                                    const logMessage = `${new Date().toISOString()} - Connected to ${username}'s live stream.\n`;
                                    fs.appendFileSync(logFilePath, logMessage);
                                    console.log(logMessage);
                                    
                                    // Init data dan setup listener
                                    initLiveData(username, state);
                                    setupListeners(monitorConnection, username);
                                })
                                .catch(error => {
                                    console.error(`Error connecting to ${username} for monitoring:`, error.message);
                                });
                        }
                    })
                    .catch(() => {
                        // Tetap offline, biarkan di list offlineAccounts
                    });
            } catch (error) {
                console.error(`Unexpected error checking ${username}:`, error.message);
            }
        }
    }, 15 * 60 * 1000); // Tetap cek setiap 15 menit
}

// Monitor connected accounts for disconnections
function monitorConnectedAccounts() {
    setInterval(() => {
        if (!isMonitoring) return; // Skip if monitoring is off

        connectedAccounts.forEach((username, index) => {
            const connection = new WebcastPushConnection(username);

            connection.connect()
                .then(() => {
                    console.log(`${username} is still connected.`);
                })
                .catch((error) => {
                    console.error(`Connection lost for ${username}:`, error.message);
                    connectedAccounts.splice(index, 1);
                    offlineAccounts.push(username);
                    const logMessage = `${new Date().toISOString()} - ${username} moved to offline due to disconnection.\n`;
                    fs.appendFileSync(logFilePath, logMessage);
                    console.log(logMessage);
                });
        });
    }, 10 * 60 * 1000); // Check every 10 minutes
}

// Helper: Check if account is still live
async function isAccountStillLive(username) {
    const connection = new WebcastPushConnection(username);
    try {
        await connection.connect();
        return true;
    } catch (error) {
        return false;
    }
}

// Store reconnect attempts per username
let reconnectAttempts = {};

// Start scraping and enable monitoring
app.post('/api/start-scraping-all', (req, res) => {
    if (liveAccounts.length === 0) {
        return res.status(400).json({ error: 'No live accounts to scrape.' });
    }

    isMonitoring = true; // Enable monitoring

    liveAccounts.forEach(username => {
        const connection = new WebcastPushConnection(username);
        reconnectAttempts[username] = 0;

        function setupListeners(conn, uname) {
            // Reset koneksi yang ada untuk username ini
            if (conn._events) {
                conn.removeAllListeners('gift');
                conn.removeAllListeners('roomUser');
                conn.removeAllListeners('streamData');
                conn.removeAllListeners('disconnected');
            }

            // Debug info untuk gift
            console.log(`Setting up listeners for ${uname}`);
            
            conn.on('gift', (giftData) => {
                // Hanya proses jika giftType !== 1 atau (giftType === 1 dan repeatEnd === true)
                if (giftData.giftType === 1 && !giftData.repeatEnd) {
                    // Streak in progress, abaikan
                    return;
                }
                if (!giftData.msgId) return; // abaikan jika tidak ada msgId
                if (processedGiftMsgIds[uname]?.has(giftData.msgId)) {
                    console.log(`Duplicate gift event for ${uname}: msgId=${giftData.msgId}`);
                    return;
                }
                processedGiftMsgIds[uname]?.add(giftData.msgId);

                // Debug info
                console.log(`Gift received for ${uname}:`, {
                    gifter: giftData.uniqueId || giftData.nickname || 'unknown',
                    giftName: giftData.giftName,
                    count: giftData.repeatCount || 1,
                    diamond: giftData.diamondCount || 0,
                    timestamp: giftData.timestamp || Date.now(),
                    msgId: giftData.msgId,
                    groupId: giftData.groupId,
                    giftType: giftData.giftType,
                    repeatEnd: giftData.repeatEnd
                });

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
            conn.on('roomUser', (data) => {
                if (typeof data.viewerCount === 'number') {
                    updateLiveData(uname, { viewer: data.viewerCount });
                }
            });
            // Fallback: also listen for streamData as before
            conn.on('streamData', (data) => {
                if (typeof data.viewerCount === 'number') {
                    updateLiveData(uname, { viewer: data.viewerCount });
                } else if (typeof data.viewer === 'number') {
                    updateLiveData(uname, { viewer: data.viewer });
                }
            });
            conn.on('disconnected', async () => {
                finalizeLiveData(uname);
                const logMsg = `${new Date().toISOString()} - Disconnected from ${uname}. Checking status...\n`;
                fs.appendFileSync(logFilePath, logMsg);
                console.log(logMsg);
                let stillLive = false;
                try {
                    stillLive = await isAccountStillLive(uname);
                } catch (e) {}
                if (stillLive && reconnectAttempts[uname] < 2) {
                    reconnectAttempts[uname]++;
                    const retryMsg = `${new Date().toISOString()} - ${uname} still live, reconnect attempt ${reconnectAttempts[uname]}...\n`;
                    fs.appendFileSync(logFilePath, retryMsg);
                    console.log(retryMsg);
                    setTimeout(() => {
                        const newConn = new WebcastPushConnection(uname);
                        setupListeners(newConn, uname);
                        newConn.connect();
                    }, 30000); // 30 seconds
                } else {
                    // Remove from connected, add to offline
                    connectedAccounts = connectedAccounts.filter(u => u !== uname);
                    if (!offlineAccounts.includes(uname)) offlineAccounts.push(uname);
                    const offMsg = `${new Date().toISOString()} - ${uname} moved to offline after disconnect.\n`;
                    fs.appendFileSync(logFilePath, offMsg);
                    console.log(offMsg);
                }
            });
        }

        connection.connect()
            .then((state) => {
                if (!connectedAccounts.includes(username)) {
                    connectedAccounts.push(username);
                    const logMessage = `${new Date().toISOString()} - Connected to ${username}'s live stream.\n`;
                    fs.appendFileSync(logFilePath, logMessage);
                    console.log(logMessage);
                }
                initLiveData(username, state);
                setupListeners(connection, username);
            })
            .catch((error) => {
                console.error(`Error connecting to ${username}:`, error.message);
            });
    });

    res.json({ message: 'Scraping started and monitoring enabled.' });
});

// Stop monitoring
app.post('/api/stop-monitoring', (req, res) => {
    isMonitoring = false; // Disable monitoring
    res.json({ message: 'Monitoring stopped.' });
});

// Stop and reset scraping, disconnect all, set all offline, save data
app.post('/api/stop-scraping-and-reset', async (req, res) => {
    // 1. Save all data
    saveLiveDataToFile();
    saveLiveDataToCSV();

    // 2. Disconnect all connections
    if (connectedAccounts && connectedAccounts.length > 0) {
        for (const username of connectedAccounts) {
            try {
                // Try to disconnect if possible
                // (WebcastPushConnection does not keep global ref, so just rely on monitoring logic)
            } catch (e) {}
        }
    }
    // 3. Set all akun ke offline, kosongkan liveAccounts, connectedAccounts, dsb
    let usernames = [];
    try {
        usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
    } catch (e) {}
    offlineAccounts = [...new Set(usernames)];
    liveAccounts = [];
    connectedAccounts = [];
    errorAccounts = [];
    isMonitoring = false;
    // 4. Reset liveDataStore (jika ingin data baru, atau biarkan untuk histori)
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
    liveDataStore[username] = {
        username,
        room_id: metadata && metadata.roomId ? metadata.roomId : null,
        timestamp_start: metadata && metadata.create_time ? formatDateToGMT7(new Date(metadata.create_time * 1000)) : formatDateToGMT7(new Date()),
        viewer: 0,
        peak_viewer: 0,
        gifts: [],
        total_diamond: 0,
        leaderboard: {},
        timestamp_end: null,
        duration: null
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

// Start monitoring live accounts on server start
monitorLiveAccounts();
monitorConnectedAccounts();

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
