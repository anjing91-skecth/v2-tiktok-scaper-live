const express = require('express');
const AccountDiscoveryService = require('../services/accountDiscovery');

const router = express.Router();
const discoveryService = new AccountDiscoveryService();

/**
 * Account Discovery Routes
 * Endpoints untuk scraping dan curation TikTok accounts
 */

// Search accounts by keywords
router.post('/search', async (req, res) => {
    try {
        const { keywords, filters = {} } = req.body;
        
        if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Keywords array is required'
            });
        }
        
        console.log('🔍 Account search request:', { keywords, filters });
        
        const results = await discoveryService.searchAccountsByKeyword(keywords, filters);
        
        res.json({
            success: true,
            data: {
                query: keywords,
                filters: filters,
                totalFound: results.length,
                accounts: results,
                timestamp: new Date()
            }
        });
        
    } catch (error) {
        console.error('Account search error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search accounts',
            details: error.message
        });
    }
});

// Curate accounts with scoring
router.post('/curate', async (req, res) => {
    try {
        const { accounts, criteria = {} } = req.body;
        
        if (!accounts || !Array.isArray(accounts)) {
            return res.status(400).json({
                success: false,
                error: 'Accounts array is required'
            });
        }
        
        console.log('🎯 Account curation request:', { 
            accountCount: accounts.length, 
            criteria 
        });
        
        const results = await discoveryService.curateAccounts(accounts, criteria);
        
        res.json({
            success: true,
            data: {
                totalProcessed: accounts.length,
                totalCurated: results.length,
                criteria: criteria,
                curatedAccounts: results,
                timestamp: new Date()
            }
        });
        
    } catch (error) {
        console.error('Account curation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to curate accounts',
            details: error.message
        });
    }
});

// Get discovery statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = await discoveryService.getDiscoveryStats();
        
        res.json({
            success: true,
            data: stats,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get stats',
            details: error.message
        });
    }
});

// Batch discovery workflow
router.post('/batch-discovery', async (req, res) => {
    try {
        const { 
            keywords = [], 
            categories = ['dance', 'music'], 
            targetCount = 50,
            filters = {}
        } = req.body;
        
        console.log('🚀 Batch discovery request:', { 
            keywords, 
            categories, 
            targetCount, 
            filters 
        });
        
        const results = await discoveryService.batchDiscovery({
            keywords,
            categories,
            targetCount,
            filters
        });
        
        res.json({
            success: true,
            data: results,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Batch discovery error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run batch discovery',
            details: error.message
        });
    }
});

// Export discovered accounts to various formats
router.post('/export', async (req, res) => {
    try {
        const { accounts, format = 'json' } = req.body;
        
        if (!accounts || !Array.isArray(accounts)) {
            return res.status(400).json({
                success: false,
                error: 'Accounts array is required'
            });
        }
        
        const exportResult = await discoveryService.exportAccounts(accounts, format);
        
        if (format === 'download') {
            res.setHeader('Content-Disposition', 'attachment; filename=discovered_accounts.json');
            res.setHeader('Content-Type', 'application/json');
            return res.send(JSON.stringify(exportResult, null, 2));
        }
        
        res.json({
            success: true,
            data: exportResult,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to export accounts',
            details: error.message
        });
    }
});

// Test account connectivity
router.post('/test-accounts', async (req, res) => {
    try {
        const { accounts } = req.body;
        
        if (!accounts || !Array.isArray(accounts)) {
            return res.status(400).json({
                success: false,
                error: 'Accounts array is required'
            });
        }
        
        console.log('🧪 Testing account connectivity:', accounts.length, 'accounts');
        
        const testResults = await discoveryService.testAccountConnectivity(accounts);
        
        res.json({
            success: true,
            data: testResults,
            timestamp: new Date()
        });
        
    } catch (error) {
        console.error('Account test error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to test accounts',
            details: error.message
        });
    }
});

module.exports = router;
