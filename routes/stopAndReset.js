const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// These will be injected from server.js
let activeConnections = {};
let monitorLiveInterval = null;
let monitorConnectedInterval = null;
let saveLiveDataToFile;
let saveLiveDataToCSV;
let accountFilePath;
let offlineAccounts = [];
let liveAccounts = [];
let connectedAccounts = [];
let errorAccounts = [];
let isMonitoring = false;
let autorecover = false;
let autorecoverFile;

function injectState(state) {
    activeConnections = state.activeConnections;
    monitorLiveInterval = state.monitorLiveInterval;
    monitorConnectedInterval = state.monitorConnectedInterval;
    saveLiveDataToFile = state.saveLiveDataToFile;
    saveLiveDataToCSV = state.saveLiveDataToCSV;
    accountFilePath = state.accountFilePath;
    offlineAccounts = state.offlineAccounts;
    liveAccounts = state.liveAccounts;
    connectedAccounts = state.connectedAccounts;
    errorAccounts = state.errorAccounts;
    isMonitoring = state.isMonitoring;
    autorecover = state.autorecover;
    autorecoverFile = state.autorecoverFile;
}

router.post('/stop-scraping-and-reset', async (req, res) => {
    saveLiveDataToFile && saveLiveDataToFile();
    saveLiveDataToCSV && saveLiveDataToCSV();
    for (const uname in activeConnections) {
        try {
            activeConnections[uname].disconnect && activeConnections[uname].disconnect();
        } catch (e) {}
    }
    activeConnections = {};
    if (monitorLiveInterval) clearInterval(monitorLiveInterval);
    if (monitorConnectedInterval) clearInterval(monitorConnectedInterval);
    let usernames = [];
    try {
        usernames = fs.readFileSync(accountFilePath, 'utf-8').split('\n').filter(Boolean);
    } catch (e) {}
    offlineAccounts = [...new Set(usernames)];
    liveAccounts = [];
    connectedAccounts = [];
    errorAccounts = [];
    isMonitoring = false;
    autorecover = false;
    if (fs.existsSync(autorecoverFile)) fs.unlinkSync(autorecoverFile);
    res.json({ message: 'All monitoring stopped, all accounts set to offline, data saved, monitoring off.' });
});

router.post('/stop-monitoring', (req, res) => {
    isMonitoring = false;
    autorecover = false;
    if (fs.existsSync(autorecoverFile)) fs.unlinkSync(autorecoverFile);
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

module.exports = { router, injectState };
