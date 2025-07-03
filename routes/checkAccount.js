const express = require('express');
const { WebcastPushConnection } = require('tiktok-live-connector');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const accountFilePath = path.join(__dirname, '../data/accounts/account.txt');

// These will be injected from server.js
let liveAccounts = [];
let offlineAccounts = [];
let errorAccounts = [];

function injectState(state) {
    liveAccounts = state.liveAccounts;
    offlineAccounts = state.offlineAccounts;
    errorAccounts = state.errorAccounts;
}

router.post('/check-live', async (req, res) => {
    const accountsToCheck = [...offlineAccounts];
    offlineAccounts.length = 0;
    for (const username of accountsToCheck) {
        try {
            const connection = new WebcastPushConnection(username);
            // Simpan koneksi agar tidak disconnect
            if (typeof activeConnections === 'object') activeConnections[username] = connection;
            const state = await connection.connect();
            let statusCode = 0;
            if (state && state.roomInfo && typeof state.roomInfo.status_code !== 'undefined') {
                statusCode = state.roomInfo.status_code;
            }
            if (statusCode === 0) {
                liveAccounts.push(username);
            } else {
                offlineAccounts.push(username);
            }
        } catch (error) {
            offlineAccounts.push(username);
        }
    }
    // Setelah pengecekan, panggil autochecker
    if (typeof global.startAutoChecker === 'function') global.startAutoChecker();
    res.json({ live: liveAccounts, offline: offlineAccounts, error: errorAccounts });
});

module.exports = { router, injectState };
