const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const PORT = 3000;
const accountFilePath = path.join(__dirname, 'account.txt');
const logFilePath = path.join(__dirname, 'scraping.log');

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

// Initialize all accounts as offline on server start
app.post('/api/initialize-accounts', (req, res) => {
    const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
    offlineAccounts = [...new Set(usernames)]; // Remove duplicates
    liveAccounts = [];
    connectedAccounts = [];
    errorAccounts = [];
    res.json({ message: 'All accounts initialized as offline.' });
});

// Update check-live to only check offline accounts
app.post('/api/check-live', async (req, res) => {
    // Jika offlineAccounts kosong, ambil ulang semua akun dari file
    if (offlineAccounts.length === 0) {
        try {
            const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
            offlineAccounts = [...new Set(usernames)];
        } catch (e) {
            return res.status(500).json({ error: 'Failed to read username list.' });
        }
    }
    const accountsToCheck = [...offlineAccounts]; // Only check offline accounts
    offlineAccounts = [];

    for (const username of accountsToCheck) {
        const connection = new WebcastPushConnection(username);
        try {
            await connection.connect();
            liveAccounts.push(username);
            console.log(`${username} is live.`);
        } catch (error) {
            if (error.message.includes("isn't online")) {
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
        if (!isMonitoring) return; // Skip if monitoring is off

        offlineAccounts.forEach((username, index) => {
            const connection = new WebcastPushConnection(username);
            connection.connect()
                .then(() => {
                    if (!liveAccounts.includes(username)) {
                        liveAccounts.push(username);
                        offlineAccounts.splice(index, 1);
                        console.log(`${username} is now live.`);

                        // Auto-connect if monitoring is on
                        if (isMonitoring) {
                            connection.connect()
                                .then(() => {
                                    if (!connectedAccounts.includes(username)) {
                                        connectedAccounts.push(username);
                                        const logMessage = `${new Date().toISOString()} - Connected to ${username}'s live stream.\n`;
                                        fs.appendFileSync(logFilePath, logMessage);
                                        console.log(logMessage);
                                    }
                                });
                        }
                    }
                })
                .catch((error) => {
                    console.error(`Error rechecking ${username}:`, error.message);
                });
        });
    }, 15 * 60 * 1000); // Check every 15 minutes
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
            conn.on('disconnected', async () => {
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
            .then(() => {
                if (!connectedAccounts.includes(username)) {
                    connectedAccounts.push(username);
                    const logMessage = `${new Date().toISOString()} - Connected to ${username}'s live stream.\n`;
                    fs.appendFileSync(logFilePath, logMessage);
                    console.log(logMessage);
                }
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

// Get current username list
app.get('/api/get-list', (req, res) => {
    try {
        const usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
        res.json({ usernames });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read username list.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Start monitoring live accounts on server start
monitorLiveAccounts();
monitorConnectedAccounts();
