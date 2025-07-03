const axios = require('axios');

// Test autochecker dengan interval 2 menit
async function testAutochecker() {
    console.log('🔍 Testing Autochecker dengan interval 2 menit...\n');
    
    try {
        // Step 1: Check initial status
        console.log('1. Checking initial status...');
        const initResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('✅ Initial status:', initResponse.data.status);
        console.log('✅ Account counts:', {
            online: initResponse.data.accounts.online.length,
            offline: initResponse.data.accounts.offline.length,
            error: initResponse.data.accounts.error.length
        });
        
        // Step 2: Start monitoring (ini akan trigger autochecker)
        console.log('\n2. Starting monitoring (this will trigger autochecker)...');
        const startResponse = await axios.post('http://localhost:3000/api/start-scraping-all');
        console.log('✅ Start response:', startResponse.data.message);
        
        // Step 3: Check status after starting
        await new Promise(resolve => setTimeout(resolve, 1000));
        const statusAfterStart = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('✅ Status after start:', statusAfterStart.data.status);
        
        // Step 4: Monitor autochecker activity
        console.log('\n3. Monitoring autochecker activity (checking every 30 seconds)...');
        console.log('⏰ Autochecker akan berjalan setiap 2 menit');
        console.log('🕐 Waktu dimulai:', new Date().toLocaleTimeString());
        
        // Monitor untuk 5 menit (untuk melihat 2 cycle autochecker)
        const totalMonitorTime = 5 * 60 * 1000; // 5 menit
        const checkInterval = 30 * 1000; // Check setiap 30 detik
        const startTime = Date.now();
        
        while (Date.now() - startTime < totalMonitorTime) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            
            const currentTime = new Date().toLocaleTimeString();
            const elapsedMinutes = Math.floor((Date.now() - startTime) / 60000);
            const elapsedSeconds = Math.floor(((Date.now() - startTime) % 60000) / 1000);
            
            console.log(`\n⏰ [${currentTime}] Elapsed: ${elapsedMinutes}m ${elapsedSeconds}s`);
            
            const currentStatus = await axios.post('http://localhost:3000/api/initialize-accounts');
            console.log('📊 Current status:', {
                autochecker: currentStatus.data.status.autochecker,
                monitoring: currentStatus.data.status.monitoring,
                scraping: currentStatus.data.status.scraping,
                accountCounts: {
                    online: currentStatus.data.accounts.online.length,
                    offline: currentStatus.data.accounts.offline.length,
                    error: currentStatus.data.accounts.error.length
                }
            });
            
            // Jika sudah 2+ menit, harusnya autochecker sudah jalan minimal 1x
            if (elapsedMinutes >= 2) {
                console.log('✅ Autochecker sudah seharusnya berjalan minimal 1x');
            }
        }
        
        // Step 5: Stop monitoring
        console.log('\n4. Stopping monitoring...');
        const stopResponse = await axios.post('http://localhost:3000/api/stop-scraping-and-reset');
        console.log('✅ Stop response:', stopResponse.data.message);
        
        console.log('\n🎉 Autochecker test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

// Jalankan test
testAutochecker();
