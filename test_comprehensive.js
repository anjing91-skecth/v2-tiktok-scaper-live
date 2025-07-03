// Test script untuk TikTok Live Scraper API
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

// Fungsi untuk menampilkan hasil test
function logResult(testName, success, message) {
    const status = success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${testName}: ${message}`);
}

// Test semua endpoint
async function runTests() {
    console.log('🚀 Memulai test TikTok Live Scraper API...\n');
    
    try {
        // 1. Test GET homepage
        console.log('📋 Testing API Endpoints:');
        const homeResponse = await axios.get(`${BASE_URL}/`);
        logResult('Homepage', homeResponse.status === 200, 'Homepage berhasil dimuat');
        
        // 2. Test GET list akun
        const listResponse = await axios.get(`${BASE_URL}/api/get-list`);
        logResult('Get List', listResponse.status === 200 && Array.isArray(listResponse.data.usernames), 
                 `${listResponse.data.usernames.length} akun ditemukan`);
        
        // 3. Test POST check live
        const checkLiveResponse = await axios.post(`${BASE_URL}/api/check-live`);
        logResult('Check Live', checkLiveResponse.status === 200, 
                 `Live: ${checkLiveResponse.data.live.length}, Offline: ${checkLiveResponse.data.offline.length}, Error: ${checkLiveResponse.data.error.length}`);
        
        // 4. Test GET live data
        const liveDataResponse = await axios.get(`${BASE_URL}/api/live-data`);
        logResult('Live Data', liveDataResponse.status === 200, 
                 `Data tersimpan: ${Object.keys(liveDataResponse.data).length} entries`);
        
        // 5. Test POST start scraping
        const startScrapingResponse = await axios.post(`${BASE_URL}/api/start-scraping-all`);
        logResult('Start Scraping', startScrapingResponse.status === 200, 
                 startScrapingResponse.data.message);
        
        // Tunggu sebentar untuk monitoring
        console.log('\n⏳ Menunggu 10 detik untuk monitoring...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        // 6. Test stop monitoring
        const stopMonitoringResponse = await axios.post(`${BASE_URL}/api/stop-monitoring`);
        logResult('Stop Monitoring', stopMonitoringResponse.status === 200, 
                 stopMonitoringResponse.data.message);
        
        // 7. Test stop scraping and reset
        const stopResetResponse = await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
        logResult('Stop & Reset', stopResetResponse.status === 200, 
                 stopResetResponse.data.message);
        
        // 8. Test edit list
        const testUsernames = ['test_user1', 'test_user2'];
        const editListResponse = await axios.post(`${BASE_URL}/api/edit-list`, {
            usernames: testUsernames
        });
        logResult('Edit List', editListResponse.status === 200, 
                 `Username list updated to ${testUsernames.length} users`);
        
        // Kembalikan list asli
        const originalUsernames = listResponse.data.usernames;
        await axios.post(`${BASE_URL}/api/edit-list`, {
            usernames: originalUsernames
        });
        logResult('Restore List', true, 'Username list restored to original');
        
        // 9. Test download CSV
        const csvResponse = await axios.get(`${BASE_URL}/api/save-and-download-csv`);
        logResult('Download CSV', csvResponse.status === 200, 
                 `CSV file size: ${csvResponse.data.length} bytes`);
        
        console.log('\n✅ Semua test selesai!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Jalankan test
runTests();
