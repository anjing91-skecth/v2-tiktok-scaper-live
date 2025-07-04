// Migration script to integrate Supabase with existing server
const fs = require('fs');
const path = require('path');

// Import existing server functions (assume they exist)
let liveDataStore = {};

// Load existing data
function loadExistingData() {
    try {
        const liveDataFile = path.join(__dirname, 'live_data.json');
        if (fs.existsSync(liveDataFile)) {
            const rawData = fs.readFileSync(liveDataFile, 'utf8');
            liveDataStore = JSON.parse(rawData);
            console.log('✅ Loaded existing live_data.json');
        }
    } catch (error) {
        console.error('❌ Error loading existing data:', error);
        liveDataStore = {};
    }
}

// Migration to Supabase
async function migrateToSupabase() {
    console.log('🔄 Starting migration to Supabase...');
    
    const supabaseClient = require('../supabase-client');
    
    // Initialize Supabase
    const initialized = supabaseClient.initializeSupabase();
    if (!initialized) {
        console.log('❌ Supabase not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to environment variables.');
        return false;
    }
    
    // Load existing data
    loadExistingData();
    
    if (Object.keys(liveDataStore).length === 0) {
        console.log('ℹ️ No existing data to migrate');
        return true;
    }
    
    // Backup to Supabase
    const success = await supabaseClient.backupToSupabase(liveDataStore);
    
    if (success) {
        console.log('✅ Migration completed successfully!');
        console.log('ℹ️ You can now safely deploy to Railway without losing data');
        return true;
    } else {
        console.log('❌ Migration failed. Check your Supabase configuration.');
        return false;
    }
}

// Test Supabase connection
async function testSupabaseConnection() {
    console.log('🔍 Testing Supabase connection...');
    
    const supabaseClient = require('../supabase-client');
    const initialized = supabaseClient.initializeSupabase();
    
    if (!initialized) {
        console.log('❌ Supabase not configured');
        return false;
    }
    
    try {
        // Try to load data (even if empty)
        const data = await supabaseClient.loadDataFromSupabase();
        console.log('✅ Supabase connection successful!');
        console.log(`📊 Found ${Object.keys(data).length} users with data in Supabase`);
        return true;
    } catch (error) {
        console.log('❌ Supabase connection failed:', error.message);
        return false;
    }
}

// Main migration function
async function runMigration() {
    console.log('🚀 TikTok Live Scraper - Supabase Migration Tool\n');
    
    // Step 1: Test connection
    const connected = await testSupabaseConnection();
    if (!connected) {
        console.log('\n📝 Setup Instructions:');
        console.log('1. Create a Supabase account at https://supabase.com');
        console.log('2. Create a new project');
        console.log('3. Go to Settings > API to get your keys');
        console.log('4. Run the SQL schema from supabase-schema.sql');
        console.log('5. Set environment variables:');
        console.log('   SUPABASE_URL=https://your-project.supabase.co');
        console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
        return;
    }
    
    // Step 2: Migrate data
    await migrateToSupabase();
    
    console.log('\n🎉 Migration process completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. ✅ Your data is now backed up in Supabase');
    console.log('2. ✅ Data will persist across Railway deployments');
    console.log('3. ✅ Add Supabase environment variables to Railway');
    console.log('4. ✅ Deploy to Railway safely');
}

// Run if called directly
if (require.main === module) {
    runMigration().catch(console.error);
}

module.exports = {
    migrateToSupabase,
    testSupabaseConnection,
    runMigration
};
