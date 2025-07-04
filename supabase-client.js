const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

let supabase = null;
let useSupabase = false;

// Initialize Supabase if credentials are provided
function initializeSupabase() {
    if (SUPABASE_URL && SUPABASE_KEY && 
        SUPABASE_URL !== 'https://your-project.supabase.co' && 
        SUPABASE_KEY !== 'your-service-role-key' &&
        SUPABASE_URL.includes('supabase.co')) {
        try {
            supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
            useSupabase = true;
            console.log('✅ Supabase initialized successfully');
            console.log(`🔗 Connected to: ${SUPABASE_URL}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Supabase:', error);
            useSupabase = false;
            return false;
        }
    } else {
        console.log('ℹ️ Supabase not configured, using local file storage');
        console.log(`🔍 Debug - URL: ${SUPABASE_URL}`);
        console.log(`🔍 Debug - Key length: ${SUPABASE_KEY ? SUPABASE_KEY.length : 0}`);
        useSupabase = false;
        return false;
    }
}

// Save session data to Supabase
async function saveSessionToSupabase(sessionData) {
    if (!useSupabase || !supabase) return false;
    
    try {
        // Prepare leaderboard as JSON
        const leaderboardJson = JSON.stringify(sessionData.leaderboard || {});
        const giftsJson = JSON.stringify(sessionData.gifts || []);
        const sessionNotesJson = JSON.stringify(sessionData.session_notes || []);
        
        const { data, error } = await supabase
            .from('live_sessions')
            .upsert({
                session_id: sessionData.session_id,
                username: sessionData.username,
                room_id: sessionData.room_id,
                timestamp_start: sessionData.timestamp_start,
                timestamp_end: sessionData.timestamp_end || null,
                timestamp_start_real: sessionData.timestamp_start_real,
                timestamp_monitoring_start: sessionData.timestamp_monitoring_start,
                create_time: sessionData.create_time,
                last_update_time: sessionData.last_update_time,
                duration: sessionData.duration,
                duration_monitored: sessionData.duration_monitored,
                viewer_count: sessionData.viewer || 0,
                peak_viewer: sessionData.peak_viewer || 0,
                total_diamond: sessionData.total_diamond || 0,
                status: sessionData.status || 'active',
                connection_attempts: sessionData.connection_attempts || 1,
                leaderboard_json: leaderboardJson,
                gifts_json: giftsJson,
                session_notes_json: sessionNotesJson,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'session_id'
            });
        
        if (error) {
            console.error('❌ Supabase save error:', error);
            return false;
        }
        
        console.log(`✅ Session saved to Supabase: ${sessionData.username} - ${sessionData.session_id}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving to Supabase:', error);
        return false;
    }
}

// Load all session data from Supabase
async function loadDataFromSupabase() {
    if (!useSupabase || !supabase) return {};
    
    try {
        const { data, error } = await supabase
            .from('live_sessions')
            .select('*')
            .order('timestamp_start', { ascending: false });
        
        if (error) {
            console.error('❌ Supabase load error:', error);
            return {};
        }
        
        // Convert back to liveDataStore format
        const reconstructedData = {};
        
        data.forEach(session => {
            if (!reconstructedData[session.username]) {
                reconstructedData[session.username] = [];
            }
            
            // Parse JSON fields back to objects
            const sessionData = {
                username: session.username,
                room_id: session.room_id,
                session_id: session.session_id,
                timestamp_start: session.timestamp_start,
                timestamp_end: session.timestamp_end,
                timestamp_start_real: session.timestamp_start_real,
                timestamp_monitoring_start: session.timestamp_monitoring_start,
                create_time: session.create_time,
                last_update_time: session.last_update_time,
                duration: session.duration,
                duration_monitored: session.duration_monitored,
                viewer: session.viewer_count,
                peak_viewer: session.peak_viewer,
                total_diamond: session.total_diamond,
                status: session.status,
                connection_attempts: session.connection_attempts,
                leaderboard: session.leaderboard_json ? JSON.parse(session.leaderboard_json) : {},
                gifts: session.gifts_json ? JSON.parse(session.gifts_json) : [],
                session_notes: session.session_notes_json ? JSON.parse(session.session_notes_json) : []
            };
            
            reconstructedData[session.username].push(sessionData);
        });
        
        console.log(`✅ Loaded ${data.length} sessions from Supabase for ${Object.keys(reconstructedData).length} users`);
        return reconstructedData;
    } catch (error) {
        console.error('❌ Error loading from Supabase:', error);
        return {};
    }
}

// Backup local data to Supabase
async function backupToSupabase(liveDataStore) {
    if (!useSupabase || !supabase) return false;
    
    try {
        let totalSaved = 0;
        
        for (const username in liveDataStore) {
            const sessions = liveDataStore[username];
            if (!Array.isArray(sessions)) continue;
            
            for (const session of sessions) {
                const saved = await saveSessionToSupabase(session);
                if (saved) totalSaved++;
            }
        }
        
        console.log(`✅ Backup completed: ${totalSaved} sessions saved to Supabase`);
        return true;
    } catch (error) {
        console.error('❌ Backup failed:', error);
        return false;
    }
}

// Save data to Supabase (alias for backupToSupabase for compatibility)
async function saveDataToSupabase(liveDataStore) {
    return await backupToSupabase(liveDataStore);
}

// Get Supabase status
function getSupabaseStatus() {
    return {
        initialized: useSupabase,
        connected: supabase !== null,
        url: SUPABASE_URL !== 'https://your-project.supabase.co' ? SUPABASE_URL : 'Not configured'
    };
}

module.exports = {
    initializeSupabase,
    saveSessionToSupabase,
    saveDataToSupabase,
    loadDataFromSupabase,
    backupToSupabase,
    getSupabaseStatus,
    useSupabase: () => useSupabase
};
