// Test Session Detection Logic
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testSessionDetection() {
    console.log('🧪 Testing Enhanced Session Detection...\n');
    
    try {
        // 1. Reset system
        await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
        console.log('✅ System reset');
        
        // 2. Check live accounts
        const checkResponse = await axios.post(`${BASE_URL}/api/check-live`);
        console.log(`✅ Found ${checkResponse.data.live.length} live accounts`);
        
        if (checkResponse.data.live.length > 0) {
            const testAccount = checkResponse.data.live[0];
            console.log(`🎯 Testing with account: ${testAccount}`);
            
            // 3. Start monitoring
            await axios.post(`${BASE_URL}/api/start-scraping-all`);
            console.log('✅ Started monitoring');
            
            // 4. Wait for data collection
            console.log('⏳ Collecting data for 10 seconds...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            // 5. Check session analysis
            const analysisResponse = await axios.get(`${BASE_URL}/api/session-analysis/${testAccount}`);
            const analysis = analysisResponse.data.analysis;
            
            console.log(`\n📊 Session Analysis for ${testAccount}:`);
            console.log(`   Total Sessions: ${analysis.total_sessions}`);
            console.log(`   Active Sessions: ${analysis.active_sessions}`);
            console.log(`   Room IDs: ${analysis.room_ids.join(', ')}`);
            
            if (analysis.session_details.length > 0) {
                const session = analysis.session_details[0];
                console.log(`   Current Session:`);
                console.log(`     - Session ID: ${session.session_id}`);
                console.log(`     - Room ID: ${session.room_id}`);
                console.log(`     - Status: ${session.status}`);
                console.log(`     - Peak Viewer: ${session.peak_viewer}`);
                console.log(`     - Notes: ${session.notes_count}`);
            }
            
            if (analysis.potential_issues.length > 0) {
                console.log(`\n⚠️  Potential Issues:`);
                analysis.potential_issues.forEach(issue => {
                    console.log(`     - ${issue.issue}`);
                });
            }
            
            // 6. Simulate session restart
            console.log('\n🔄 Testing session restart...');
            await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
            console.log('✅ Stopped monitoring (sessions should be finalized)');
            
            // 7. Check if sessions are finalized
            const analysisAfterStop = await axios.get(`${BASE_URL}/api/session-analysis/${testAccount}`);
            const finalizedSessions = analysisAfterStop.data.analysis.finalized_sessions;
            console.log(`✅ Finalized sessions: ${finalizedSessions}`);
            
            // 8. Start monitoring again
            await axios.post(`${BASE_URL}/api/check-live`);
            await axios.post(`${BASE_URL}/api/start-scraping-all`);
            console.log('✅ Started monitoring again');
            
            // 9. Wait and check if new session is created
            await new Promise(resolve => setTimeout(resolve, 5000));
            const finalAnalysis = await axios.get(`${BASE_URL}/api/session-analysis/${testAccount}`);
            console.log(`✅ Total sessions after restart: ${finalAnalysis.data.analysis.total_sessions}`);
            
            // 10. Final cleanup
            await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
            console.log('✅ Final cleanup completed');
            
        } else {
            console.log('⚠️  No live accounts found for testing');
        }
        
        // 11. Test session analysis API for all users
        console.log('\n📊 Testing session analysis for all users...');
        const allAnalysisResponse = await axios.get(`${BASE_URL}/api/session-analysis`);
        const allAnalysis = allAnalysisResponse.data;
        
        Object.entries(allAnalysis).forEach(([username, analysis]) => {
            console.log(`   ${username}: ${analysis.total_sessions} sessions, ${analysis.room_ids.length} unique rooms`);
        });
        
        console.log('\n✅ Session detection testing completed!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Run test
testSessionDetection();
