const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();

let saveLiveDataToCSV;
let csvFilePath;

function injectState(state) {
    saveLiveDataToCSV = state.saveLiveDataToCSV;
    csvFilePath = state.csvFilePath;
}

router.get('/save-and-download-csv', (req, res) => {
    try {
        console.log('📥 Download CSV requested');
        
        // Generate fresh CSV
        if (saveLiveDataToCSV) {
            saveLiveDataToCSV();
            console.log('✅ CSV data refreshed');
        } else {
            console.error('❌ saveLiveDataToCSV function not available');
            return res.status(500).json({ error: 'CSV generation function not available' });
        }
        
        // Check if file exists
        if (!fs.existsSync(csvFilePath)) {
            console.error('❌ CSV file not found:', csvFilePath);
            return res.status(404).json({ error: 'CSV file not found' });
        }
        
        // Check file size
        const stats = fs.statSync(csvFilePath);
        console.log(`📄 CSV file size: ${stats.size} bytes`);
        
        // Set proper headers
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="live_data.csv"');
        
        // Send file
        res.download(csvFilePath, 'live_data.csv', (err) => {
            if (err) {
                console.error('❌ Download error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Download failed' });
                }
            } else {
                console.log('✅ CSV downloaded successfully');
            }
        });
        
    } catch (error) {
        console.error('❌ Download error:', error);
        res.status(500).json({ error: 'Failed to download CSV' });
    }
});

module.exports = { router, injectState };
