const axios = require('axios');

// Test autochecker sederhana
async function testAutocheckerSimple() {
    console.log('🔍 Testing Autochecker (interval 2 menit) - Simple Test\n');
    
    try {
        // Step 1: Start monitoring
        console.log('1. Starting monitoring...');
        const startResponse = await axios.post('http://localhost:3000/api/start-scraping-all');
        console.log('✅ Start response:', startResponse.data.message);
        
        // Step 2: Check status
        const statusResponse = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('✅ Status:', statusResponse.data.status);
        console.log('✅ Accounts:', {
            online: statusResponse.data.accounts.online.length,
            offline: statusResponse.data.accounts.offline.length,
            error: statusResponse.data.accounts.error.length
        });
        
        console.log('\n⏰ Autochecker akan berjalan setiap 2 menit');
        console.log('🕐 Waktu dimulai:', new Date().toLocaleTimeString());
        console.log('📝 Cek server logs untuk melihat aktivitas autochecker...');
        
        // Wait untuk 2.5 menit untuk melihat 1 cycle autochecker
        console.log('\n⏳ Waiting 2.5 menit untuk melihat autochecker berjalan...');
        
        for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 30000)); // 30 detik
            const elapsed = (i + 1) * 30;
            console.log(`⏰ ${elapsed} seconds elapsed...`);
            
            if (elapsed >= 120) { // 2 menit
                console.log('✅ Autochecker should have run at least once by now');
            }
        }
        
        // Check final status
        const finalStatus = await axios.post('http://localhost:3000/api/initialize-accounts');
        console.log('\n📊 Final status:', finalStatus.data.status);
        console.log('📊 Final accounts:', {
            online: finalStatus.data.accounts.online.length,
            offline: finalStatus.data.accounts.offline.length,
            error: finalStatus.data.accounts.error.length
        });
        
        console.log('\n🎉 Test completed! Check server logs for autochecker activity.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Jalankan test
testAutocheckerSimple();
