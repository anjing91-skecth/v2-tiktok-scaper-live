const axios = require('axios');

// Test script untuk memahami fungsi autochecker
async function testAutocheckerFunction() {
    console.log('🔍 Testing Autochecker Function...\n');
    
    try {
        // Test 1: Get current status
        console.log('1. Current Status:');
        const initResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('   Status:', initResponse.data.status);
        console.log('   Accounts:', {
            online: initResponse.data.accounts.online.length,
            offline: initResponse.data.accounts.offline.length,
            error: initResponse.data.accounts.error.length
        });
        
        // Test 2: Check how autochecker works
        console.log('\n2. Autochecker Analysis:');
        console.log('   - Autochecker Active:', initResponse.data.status.autochecker);
        console.log('   - Monitoring Active:', initResponse.data.status.monitoring);
        console.log('   - Scraping Active:', initResponse.data.status.scraping);
        
        if (initResponse.data.status.autochecker) {
            console.log('   ✅ Autochecker is running - checking offline accounts every 15 minutes');
        } else {
            console.log('   ❌ Autochecker is not running');
        }
        
        // Test 3: Test check-live to see how it affects autochecker
        console.log('\n3. Testing check-live impact on autochecker:');
        const checkResponse = await axios.post('http://localhost:3000/api/check-live');
        console.log('   Check-live result:', {
            live: checkResponse.data.live.length,
            offline: checkResponse.data.offline.length,
            error: checkResponse.data.error.length
        });
        
        // Wait 2 seconds then check status again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterCheckResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('   After check-live status:', afterCheckResponse.data.status);
        
        // Test 4: Test start-scraping-all impact on autochecker
        console.log('\n4. Testing start-scraping-all impact on autochecker:');
        const startResponse = await axios.post('http://localhost:3000/api/start-scraping-all');
        console.log('   Start scraping result:', startResponse.data.message);
        
        // Wait 2 seconds then check status again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterStartResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('   After start-scraping status:', afterStartResponse.data.status);
        
        // Test 5: Test stop-scraping-and-reset impact on autochecker
        console.log('\n5. Testing stop-scraping-and-reset impact on autochecker:');
        const stopResponse = await axios.post('http://localhost:3000/api/stop-scraping-and-reset');
        console.log('   Stop scraping result:', stopResponse.data.message);
        
        // Wait 2 seconds then check status again
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const afterStopResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('   After stop-scraping status:', afterStopResponse.data.status);
        
        // Test 6: Explain autochecker logic
        console.log('\n6. Autochecker Logic Explanation:');
        console.log('   📚 How Autochecker Works:');
        console.log('   - Runs every 15 minutes (900,000ms)');
        console.log('   - Only checks offline accounts');
        console.log('   - Automatically starts scraping when finds live accounts');
        console.log('   - Stops automatically when no offline accounts remain');
        console.log('   - Uses rate limiting to avoid API blocks');
        console.log('   - Emits real-time updates via socket.io');
        
        console.log('\n7. Current Autochecker Behavior:');
        if (afterStopResponse.data.accounts.offline.length > 0) {
            console.log('   ✅ Autochecker should be active (offline accounts exist)');
            console.log('   📊 Will check', afterStopResponse.data.accounts.offline.length, 'offline accounts every 15 minutes');
        } else {
            console.log('   ❌ Autochecker should stop (no offline accounts)');
        }
        
        console.log('\n🎯 Summary:');
        console.log('   - Autochecker is a background process that periodically checks offline accounts');
        console.log('   - It runs independently of manual monitoring');
        console.log('   - When it finds live accounts, it automatically starts scraping');
        console.log('   - It uses intelligent rate limiting to avoid being blocked');
        console.log('   - It provides real-time updates to the frontend');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Jalankan test
testAutocheckerFunction();
