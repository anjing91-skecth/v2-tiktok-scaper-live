const { TikTokLiveConnection, SignConfig } = require('tiktok-live-connector');

// Test script to check rate limits and API functionality
async function testRateLimits() {
    console.log('Testing EulerStream API Rate Limits...');
    
    try {
        // Create a connection to test
        const connection = new TikTokLiveConnection('glow_babies1');
        
        // Try to get rate limits if available
        if (connection.webClient && connection.webClient.webSigner) {
            try {
                const rateLimitResponse = await connection.webClient.webSigner.webcast.getRateLimits();
                console.log('Rate Limits:', rateLimitResponse.data);
            } catch (error) {
                console.log('Rate limits not available or error:', error.message);
            }
        }
        
        // Test basic connection (without connecting fully)
        try {
            const roomInfo = await connection.fetchRoomInfo();
            console.log('Room Info Test - Success:', {
                roomId: roomInfo.roomId,
                status: roomInfo.status,
                user: roomInfo.owner?.uniqueId,
                createTime: roomInfo.create_time
            });
        } catch (error) {
            console.log('Room Info Test - Error:', error.message);
        }
        
        // Test if the user is live
        try {
            const isLive = await connection.fetchIsLive();
            console.log('Is Live Test - Success:', isLive);
        } catch (error) {
            console.log('Is Live Test - Error:', error.message);
        }
        
    } catch (error) {
        console.error('General error:', error);
    }
}

// Test multiple connections to simulate rate limiting
async function testMultipleConnections() {
    console.log('\nTesting Multiple Connections (Rate Limiting)...');
    
    const usernames = ['glow_babies1', 'officialgeilegisela', 'tv_asahi_news'];
    const promises = [];
    
    usernames.forEach((username, index) => {
        promises.push(
            (async () => {
                try {
                    const connection = new TikTokLiveConnection(username);
                    const startTime = Date.now();
                    
                    const isLive = await connection.fetchIsLive();
                    const endTime = Date.now();
                    
                    console.log(`${index + 1}. ${username}: ${isLive ? 'LIVE' : 'OFFLINE'} (${endTime - startTime}ms)`);
                    return { username, isLive, duration: endTime - startTime };
                } catch (error) {
                    console.log(`${index + 1}. ${username}: ERROR - ${error.message}`);
                    return { username, error: error.message };
                }
            })()
        );
    });
    
    try {
        const results = await Promise.all(promises);
        console.log('\nResults Summary:');
        results.forEach((result, index) => {
            if (result.error) {
                console.log(`${index + 1}. ${result.username}: ERROR - ${result.error}`);
            } else {
                console.log(`${index + 1}. ${result.username}: ${result.isLive ? 'LIVE' : 'OFFLINE'} (${result.duration}ms)`);
            }
        });
    } catch (error) {
        console.error('Error with multiple connections:', error);
    }
}

// Test sequential connections (recommended approach)
async function testSequentialConnections() {
    console.log('\nTesting Sequential Connections (Recommended)...');
    
    const usernames = ['glow_babies1', 'officialgeilegisela', 'tv_asahi_news'];
    const results = [];
    
    for (let i = 0; i < usernames.length; i++) {
        const username = usernames[i];
        try {
            const connection = new TikTokLiveConnection(username);
            const startTime = Date.now();
            
            const isLive = await connection.fetchIsLive();
            const endTime = Date.now();
            
            console.log(`${i + 1}. ${username}: ${isLive ? 'LIVE' : 'OFFLINE'} (${endTime - startTime}ms)`);
            results.push({ username, isLive, duration: endTime - startTime });
            
            // Add small delay between requests
            await new Promise(resolve => setTimeout(resolve, 500));
            
        } catch (error) {
            console.log(`${i + 1}. ${username}: ERROR - ${error.message}`);
            results.push({ username, error: error.message });
            
            // Add longer delay on error (might be rate limited)
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    console.log('\nSequential Results Summary:');
    results.forEach((result, index) => {
        if (result.error) {
            console.log(`${index + 1}. ${result.username}: ERROR - ${result.error}`);
        } else {
            console.log(`${index + 1}. ${result.username}: ${result.isLive ? 'LIVE' : 'OFFLINE'} (${result.duration}ms)`);
        }
    });
}

// Main test function
async function main() {
    console.log('='.repeat(60));
    console.log('TikTok Live Connector - Rate Limiting Test');
    console.log('='.repeat(60));
    
    await testRateLimits();
    await testMultipleConnections();
    await testSequentialConnections();
    
    console.log('\n='.repeat(60));
    console.log('Test completed!');
    console.log('='.repeat(60));
}

main().catch(console.error);
