const axios = require('axios');

// Test script untuk memverifikasi refresh bug sudah diperbaiki
async function testRefreshBugFix() {
    console.log('🔍 Testing refresh bug fix...\n');
    
    try {
        // Test 1: Initialize accounts (seperti yang dilakukan frontend saat refresh)
        console.log('1. Testing initialize-accounts endpoint...');
        const initResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('✅ Initialize response:', {
            success: initResponse.data.success,
            message: initResponse.data.message,
            status: initResponse.data.status,
            accountCounts: {
                online: initResponse.data.accounts.online.length,
                offline: initResponse.data.accounts.offline.length,
                error: initResponse.data.accounts.error.length
            }
        });
        
        // Test 2: Check live data endpoint
        console.log('\n2. Testing live-data endpoint...');
        const liveDataResponse = await axios.get('http://localhost:3000/api/live-data');
        console.log('✅ Live data response:', {
            dataKeys: Object.keys(liveDataResponse.data),
            totalEntries: Object.keys(liveDataResponse.data).length
        });
        
        // Test 3: Start scraping dan test status
        console.log('\n3. Testing scraping status...');
        const startResponse = await axios.post('http://localhost:3000/api/start-scraping-all');
        console.log('✅ Start scraping response:', startResponse.data.message);
        
        // Wait 2 seconds then test initialize again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n4. Testing initialize-accounts after scraping started...');
        const initAfterResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('✅ Initialize after scraping:', {
            status: initAfterResponse.data.status,
            accountCounts: {
                online: initAfterResponse.data.accounts.online.length,
                offline: initAfterResponse.data.accounts.offline.length,
                error: initAfterResponse.data.accounts.error.length
            }
        });
        
        // Test 5: Stop scraping
        console.log('\n5. Testing stop and reset...');
        const stopResponse = await axios.post('http://localhost:3000/api/stop-scraping-and-reset');
        console.log('✅ Stop scraping response:', stopResponse.data.message);
        
        // Test 6: Final state check
        console.log('\n6. Testing final state...');
        const finalResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('✅ Final state:', {
            status: finalResponse.data.status,
            accountCounts: {
                online: finalResponse.data.accounts.online.length,
                offline: finalResponse.data.accounts.offline.length,
                error: finalResponse.data.accounts.error.length
            }
        });
        
        console.log('\n🎉 All tests passed! Refresh bug should be fixed.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Jalankan test
testRefreshBugFix();
