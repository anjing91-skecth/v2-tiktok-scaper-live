const express = require('express');
const path = require('path');
const router = express.Router();

let saveLiveDataToCSV;
let csvFilePath;

function injectState(state) {
    saveLiveDataToCSV = state.saveLiveDataToCSV;
    csvFilePath = state.csvFilePath;
}

router.get('/save-and-download-csv', (req, res) => {
    saveLiveDataToCSV && saveLiveDataToCSV();
    res.download(csvFilePath, 'live_data.csv');
});

module.exports = { router, injectState };
