const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Manual table creation
async function createTables() {
    console.log('🔧 Creating database tables...\n');
    
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    try {
        // First, create the table using raw SQL
        const createTableSQL = `
            CREATE TABLE IF NOT EXISTS live_sessions (
                id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
                session_id VARCHAR(100) UNIQUE NOT NULL,
                username VARCHAR(100) NOT NULL,
                room_id VARCHAR(50),
                timestamp_start VARCHAR(50),
                timestamp_end VARCHAR(50),
                timestamp_start_real VARCHAR(50),
                timestamp_monitoring_start VARCHAR(50),
                create_time VARCHAR(50),
                last_update_time TIMESTAMP,
                duration VARCHAR(20),
                duration_monitored VARCHAR(20),
                viewer_count INTEGER DEFAULT 0,
                peak_viewer INTEGER DEFAULT 0,
                total_diamond INTEGER DEFAULT 0,
                status VARCHAR(20) DEFAULT 'active',
                connection_attempts INTEGER DEFAULT 1,
                leaderboard_json TEXT,
                gifts_json TEXT,
                session_notes_json TEXT,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
        `;
        
        // Try to create using rpc
        const { data, error } = await supabase.rpc('exec_sql', {
            query: createTableSQL
        });
        
        if (error) {
            console.log('Direct SQL failed, trying insert method...');
            
            // Test if table exists by trying to insert
            const { error: insertError } = await supabase
                .from('live_sessions')
                .insert({
                    session_id: 'test_' + Date.now(),
                    username: 'test_user',
                    room_id: 'test_room',
                    status: 'test'
                });
                
            if (insertError) {
                if (insertError.message.includes('does not exist')) {
                    console.log('❌ Table does not exist. Manual setup required.');
                    console.log('\n🔧 PLEASE DO THIS MANUALLY:');
                    console.log('1. Go to: https://supabase.com/dashboard/project/wilruvbfexhwqbindoon');
                    console.log('2. Click "SQL Editor" in the left sidebar');
                    console.log('3. Copy and paste the following SQL:');
                    console.log('\n--- COPY THIS SQL ---');
                    console.log(createTableSQL);
                    console.log('--- END SQL ---\n');
                    console.log('4. Click "RUN" button');
                    console.log('5. Then run: node migrate-to-supabase.js');
                    return false;
                } else {
                    // Table exists but insert failed for other reason, delete test row
                    await supabase
                        .from('live_sessions')
                        .delete()
                        .eq('username', 'test_user');
                }
            } else {
                // Insert successful, delete test row
                await supabase
                    .from('live_sessions')
                    .delete()
                    .eq('username', 'test_user');
            }
        }
        
        console.log('✅ Table ready!');
        
        // Test final access
        const { data: testData, error: testError } = await supabase
            .from('live_sessions')
            .select('*')
            .limit(1);
            
        if (testError) {
            throw testError;
        }
        
        console.log('✅ Database setup completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

createTables();
