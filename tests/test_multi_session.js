// Advanced Multi-Session Test
const axios = require('axios');

const BASE_URL = 'http://localhost:3000';

async function testMultiSessionScenario() {
    console.log('🔄 Testing Multi-Session Scenarios...\n');
    
    try {
        // 1. Reset system
        await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
        console.log('✅ System reset');
        
        // 2. Check for live accounts
        const checkResponse = await axios.post(`${BASE_URL}/api/check-live`);
        console.log(`✅ Found ${checkResponse.data.live.length} live accounts`);
        
        if (checkResponse.data.live.length > 0) {
            const testAccount = checkResponse.data.live[0];
            console.log(`🎯 Testing multi-session with: ${testAccount}\n`);
            
            // Scenario 1: Normal session lifecycle
            console.log('📋 Scenario 1: Normal Session Lifecycle');
            await axios.post(`${BASE_URL}/api/start-scraping-all`);
            console.log('   ✅ Started monitoring');
            
            await new Promise(resolve => setTimeout(resolve, 8000));
            console.log('   ⏳ Collected data for 8 seconds');
            
            let analysis = await axios.get(`${BASE_URL}/api/session-analysis/${testAccount}`);
            console.log(`   📊 Sessions: ${analysis.data.analysis.total_sessions}, Status: ${analysis.data.analysis.session_details[0]?.status || 'none'}`);
            
            await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
            console.log('   ✅ Session finalized\n');
            
            // Scenario 2: Session restart (should create new session)
            console.log('📋 Scenario 2: Session Restart');
            await axios.post(`${BASE_URL}/api/check-live`);
            await axios.post(`${BASE_URL}/api/start-scraping-all`);
            console.log('   ✅ Started monitoring again');
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            analysis = await axios.get(`${BASE_URL}/api/session-analysis/${testAccount}`);
            console.log(`   📊 Total sessions now: ${analysis.data.analysis.total_sessions}`);
            console.log(`   📋 Session details:`);
            
            analysis.data.analysis.session_details.forEach((session, index) => {
                console.log(`      Session ${index + 1}:`);
                console.log(`        - ID: ${session.session_id}`);
                console.log(`        - Room: ${session.room_id}`);
                console.log(`        - Status: ${session.status}`);
                console.log(`        - Duration: ${session.duration}`);
                console.log(`        - Peak Viewers: ${session.peak_viewer}`);
            });
            
            // Check for potential issues
            if (analysis.data.analysis.potential_issues.length > 0) {
                console.log(`   ⚠️  Potential Issues:`);
                analysis.data.analysis.potential_issues.forEach(issue => {
                    console.log(`      - ${issue.issue}`);
                });
            } else {
                console.log('   ✅ No potential issues detected');
            }
            
            await axios.post(`${BASE_URL}/api/stop-scraping-and-reset`);
            console.log('   ✅ Final cleanup\n');
            
            // Scenario 3: Room ID analysis
            console.log('📋 Scenario 3: Room ID Analysis');
            const roomIds = analysis.data.analysis.room_ids;
            console.log(`   📊 Unique Room IDs: ${roomIds.length}`);
            console.log(`   🏠 Room IDs: ${roomIds.join(', ')}`);
            
            if (roomIds.length === 1 && analysis.data.analysis.total_sessions > 1) {
                console.log('   🎯 Multi-session detection working correctly!');
                console.log('   📝 Same Room ID used across different sessions');
            }
            
        } else {
            console.log('⚠️  No live accounts found for multi-session testing');
        }
        
        // Final system status
        console.log('\n📊 Final System Analysis:');
        const finalAnalysis = await axios.get(`${BASE_URL}/api/session-analysis`);
        
        Object.entries(finalAnalysis.data).forEach(([username, analysis]) => {
            console.log(`   ${username}:`);
            console.log(`     - Total Sessions: ${analysis.total_sessions}`);
            console.log(`     - Finalized Sessions: ${analysis.finalized_sessions}`);
            console.log(`     - Unique Rooms: ${analysis.room_ids.length}`);
            console.log(`     - Issues: ${analysis.potential_issues.length}`);
        });
        
        console.log('\n✅ Multi-session testing completed!');
        
    } catch (error) {
        console.error('❌ Error during testing:', error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        }
    }
}

// Run test
testMultiSessionScenario();
