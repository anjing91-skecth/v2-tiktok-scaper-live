// Test untuk bug fixes
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testBugFixes() {
    console.log('🧪 Testing Bug Fixes...\n');
    
    try {
        // Test 1: Multi-session bug fix
        console.log('1️⃣ Testing multi-session bug fix:');
        
        // Reset sistem
        await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
        console.log('✅ System reset');
        
        // Check live untuk mendapatkan akun live
        const checkResponse = await axios.post(`${BASE_URL}/api/check-live`);
        console.log(`✅ Check live: ${checkResponse.data.live.length} live accounts`);
        
        if (checkResponse.data.live.length > 0) {
            // Start scraping
            await axios.post(`${BASE_URL}/api/start-scraping-all`);
            console.log('✅ Started scraping');
            
            // Tunggu beberapa detik
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Stop scraping (ini akan finalize sesi)
            await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
            console.log('✅ Stopped and reset (sessions finalized)');
            
            // Check live lagi - ini seharusnya berhasil membuat sesi baru
            const checkResponse2 = await axios.post(`${BASE_URL}/api/check-live`);
            console.log(`✅ Check live after reset: ${checkResponse2.data.live.length} live accounts`);
            
            if (checkResponse2.data.live.length > 0) {
                // Start scraping lagi - ini seharusnya berhasil
                const startResponse = await axios.post(`${BASE_URL}/api/start-scraping-all`);
                console.log('✅ Started scraping again after finalized sessions');
                
                // Tunggu dan stop lagi
                await new Promise(resolve => setTimeout(resolve, 3000));
                await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
                console.log('✅ Final cleanup');
            }
        } else {
            console.log('⚠️ No live accounts found for testing');
        }
        
        // Test 2: Check data structure
        console.log('\n2️⃣ Testing data structure improvements:');
        const liveDataResponse = await axios.get(`${BASE_URL}/api/live-data`);
        const liveData = liveDataResponse.data;
        
        for (const username in liveData) {
            const sessions = liveData[username];
            if (Array.isArray(sessions)) {
                sessions.forEach((session, index) => {
                    console.log(`📊 ${username} session ${index + 1}:`);
                    console.log(`   - Status: ${session.status}`);
                    console.log(`   - Duration: ${session.duration || 'N/A'}`);
                    console.log(`   - Duration Monitored: ${session.duration_monitored || 'N/A'}`);
                    console.log(`   - Real Start: ${session.timestamp_start_real || 'N/A'}`);
                    console.log(`   - Monitor Start: ${session.timestamp_monitoring_start || 'N/A'}`);
                });
            }
        }
        
        console.log('\n✅ Bug fix testing completed!');
        
    } catch (error) {
        console.error('❌ Error during bug fix testing:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Jalankan test
testBugFixes();
