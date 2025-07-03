// Quick test untuk check individual account
const { WebcastPushConnection } = require("tiktok-live-connector");

async function testSingleAccount(username) {
    console.log(`Testing ${username}...`);
    const connection = new WebcastPushConnection(username);
    
    try {
        await connection.connect();
        console.log(`✅ ${username} is LIVE`);
        
        // Get some basic info
        console.log(`Room ID: ${connection.state?.roomId || 'N/A'}`);
        console.log(`Create Time: ${connection.state?.create_time || 'N/A'}`);
        
        connection.disconnect();
        return true;
    } catch (error) {
        if (error.message && error.message.includes("isn't online")) {
            console.log(`❌ ${username} is OFFLINE`);
        } else {
            console.log(`⚠️ ${username} ERROR: ${error.message}`);
        }
        return false;
    }
}

async function testMultipleAccounts() {
    const accounts = [
        'tiramisu_dance',
        'firedance.fd', 
        'cocoberrygirls',
        'nova_deluna',
        'sky_weeekly'
    ];
    
    console.log('🧪 Testing TikTok Live connections...\n');
    
    let liveCount = 0;
    let offlineCount = 0;
    let errorCount = 0;
    
    for (const account of accounts) {
        const result = await testSingleAccount(account);
        if (result) {
            liveCount++;
        } else {
            offlineCount++;
        }
        console.log('---');
    }
    
    console.log(`\n📊 Results:`);
    console.log(`Live: ${liveCount}`);
    console.log(`Offline: ${offlineCount}`);
    console.log(`Errors: ${errorCount}`);
}

testMultipleAccounts();
