#!/usr/bin/env node

/**
 * Setup Supabase Flags Table
 * This script creates the flags table in Supabase and initializes default flags
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Supabase credentials not found in environment variables');
    console.error('   Please check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

async function setupFlagsTable() {
    try {
        console.log('🔧 Setting up Supabase flags table...');
        
        // Create Supabase client
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        
        // Read SQL file
        const sqlPath = path.join(__dirname, 'sql', 'create_flags_table.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        // Execute SQL
        console.log('📄 Executing SQL script...');
        const { data, error } = await supabase.rpc('exec_sql', { sql: sqlContent });
        
        if (error) {
            console.error('❌ SQL execution failed:', error);
            
            // Fallback: Try creating table directly using Supabase client
            console.log('🔄 Trying alternative approach...');
            
            // Create table using individual operations
            const { error: createError } = await supabase.rpc('exec_sql', {
                sql: `
                CREATE TABLE IF NOT EXISTS flags (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    value TEXT NOT NULL,
                    description TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                CREATE INDEX IF NOT EXISTS idx_flags_name ON flags(name);
                `
            });
            
            if (createError) {
                console.error('❌ Alternative table creation failed:', createError);
                console.log('ℹ️  Please run the SQL manually in Supabase dashboard');
                return false;
            }
        }
        
        console.log('✅ Flags table created successfully');
        
        // Test the table by inserting and reading a flag
        console.log('🧪 Testing flags table...');
        
        // Insert test flag
        const { error: insertError } = await supabase
            .from('flags')
            .upsert({
                name: 'setup_test',
                value: 'true',
                description: 'Test flag to verify table setup'
            });
        
        if (insertError) {
            console.error('❌ Test insert failed:', insertError);
            return false;
        }
        
        // Read test flag
        const { data: testData, error: readError } = await supabase
            .from('flags')
            .select('*')
            .eq('name', 'setup_test')
            .single();
        
        if (readError) {
            console.error('❌ Test read failed:', readError);
            return false;
        }
        
        console.log('✅ Test flag read successfully:', testData);
        
        // Initialize default flags
        console.log('🔄 Initializing default flags...');
        
        const defaultFlags = [
            {
                name: 'autorecover',
                value: 'false',
                description: 'Auto-recovery system flag - enables automatic monitoring restart after server restarts'
            },
            {
                name: 'maintenance_mode',
                value: 'false',
                description: 'System maintenance mode flag'
            },
            {
                name: 'debug_mode',
                value: 'false',
                description: 'Debug logging mode flag'
            },
            {
                name: 'rate_limit_strict',
                value: 'false',
                description: 'Strict rate limiting mode flag'
            }
        ];
        
        for (const flag of defaultFlags) {
            const { error: flagError } = await supabase
                .from('flags')
                .upsert(flag, { onConflict: 'name' });
            
            if (flagError) {
                console.error(`❌ Failed to initialize flag ${flag.name}:`, flagError);
            } else {
                console.log(`✅ Flag ${flag.name} initialized`);
            }
        }
        
        // Clean up test flag
        await supabase
            .from('flags')
            .delete()
            .eq('name', 'setup_test');
        
        console.log('🎉 Flags table setup completed successfully!');
        return true;
        
    } catch (error) {
        console.error('❌ Setup failed:', error);
        return false;
    }
}

// Run setup if called directly
if (require.main === module) {
    setupFlagsTable().then(success => {
        if (success) {
            console.log('\n✅ Setup completed successfully');
            console.log('🔧 You can now use flag management APIs:');
            console.log('   • GET /api/flag/:flagName - Get flag value');
            console.log('   • POST /api/flag/:flagName - Set flag value');
            console.log('   • DELETE /api/flag/:flagName - Delete flag');
            console.log('');
            console.log('📦 Autorecover flag will now persist across deployments!');
        } else {
            console.log('\n❌ Setup failed');
            console.log('Please check the errors above and try again');
        }
        process.exit(success ? 0 : 1);
    });
}

module.exports = { setupFlagsTable };
