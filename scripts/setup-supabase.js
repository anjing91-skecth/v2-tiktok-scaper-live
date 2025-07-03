const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Setup Supabase database schema
async function setupSupabaseSchema() {
    console.log('🔧 Setting up Supabase database schema...\n');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
        return false;
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
        console.log('1. Testing connection...');
        
        // Test connection
        const { data: testData, error: testError } = await supabase
            .from('_test')
            .select('*')
            .limit(1);
        
        if (testError && !testError.message.includes("relation") && !testError.message.includes("does not exist")) {
            throw testError;
        }
        
        console.log('✅ Connection successful!');
        
        console.log('\n2. Creating live_sessions table...');
        
        // Create the main table
        const { error: createError } = await supabase.rpc('exec_sql', {
            sql: `
                -- Create live_sessions table
                CREATE TABLE IF NOT EXISTS live_sessions (
                    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                    
                    -- Session Identifiers
                    session_id VARCHAR(100) UNIQUE NOT NULL,
                    username VARCHAR(100) NOT NULL,
                    room_id VARCHAR(50),
                    
                    -- Timestamps
                    timestamp_start VARCHAR(50),
                    timestamp_end VARCHAR(50),
                    timestamp_start_real VARCHAR(50),
                    timestamp_monitoring_start VARCHAR(50),
                    create_time VARCHAR(50),
                    last_update_time TIMESTAMP,
                    
                    -- Duration
                    duration VARCHAR(20),
                    duration_monitored VARCHAR(20),
                    
                    -- Viewer Data
                    viewer_count INTEGER DEFAULT 0,
                    peak_viewer INTEGER DEFAULT 0,
                    
                    -- Gift Data
                    total_diamond INTEGER DEFAULT 0,
                    
                    -- Status
                    status VARCHAR(20) DEFAULT 'active',
                    connection_attempts INTEGER DEFAULT 1,
                    
                    -- JSON Data (for complex objects)
                    leaderboard_json TEXT,
                    gifts_json TEXT,
                    session_notes_json TEXT,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                
                -- Create indexes
                CREATE INDEX IF NOT EXISTS idx_live_sessions_username ON live_sessions(username);
                CREATE INDEX IF NOT EXISTS idx_live_sessions_session_id ON live_sessions(session_id);
                CREATE INDEX IF NOT EXISTS idx_live_sessions_timestamp_start ON live_sessions(timestamp_start);
                CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
                CREATE INDEX IF NOT EXISTS idx_live_sessions_created_at ON live_sessions(created_at);
            `
        });
        
        if (createError) {
            console.log('Using alternative method to create table...');
            
            // Alternative method - direct SQL execution
            const { error: altError } = await supabase
                .from('live_sessions')
                .select('*')
                .limit(1);
                
            if (altError && altError.message.includes('does not exist')) {
                console.log('Table does not exist. Please run the SQL schema manually in Supabase dashboard.');
                console.log('\n📋 MANUAL SETUP REQUIRED:');
                console.log('1. Go to your Supabase dashboard: https://supabase.com/dashboard');
                console.log('2. Open your project: tiktok-live-scraper-v2');
                console.log('3. Click "SQL Editor" in the sidebar');
                console.log('4. Copy and paste the SQL from supabase-schema.sql file');
                console.log('5. Click "RUN" to execute');
                console.log('6. Then run this script again');
                return false;
            }
        }
        
        console.log('✅ Table setup completed!');
        
        console.log('\n3. Testing table access...');
        
        // Test table access
        const { data, error } = await supabase
            .from('live_sessions')
            .select('*')
            .limit(1);
        
        if (error) {
            throw error;
        }
        
        console.log('✅ Table access successful!');
        
        console.log('\n🎉 Supabase setup completed successfully!');
        console.log('✅ Database is ready for data persistence');
        
        return true;
        
    } catch (error) {
        console.error('❌ Setup failed:', error.message);
        console.log('\n📋 MANUAL SETUP INSTRUCTIONS:');
        console.log('1. Go to Supabase dashboard: https://supabase.com/dashboard');
        console.log('2. Open SQL Editor');
        console.log('3. Run the SQL schema from supabase-schema.sql');
        console.log('4. Then test connection again');
        return false;
    }
}

// Run setup
if (require.main === module) {
    setupSupabaseSchema();
}

module.exports = { setupSupabaseSchema };
