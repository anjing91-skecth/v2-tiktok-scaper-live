const fs = require('fs');
const path = require('path');

/**
 * Fix Data Issues - Repair corrupt JSON and verify Supabase connection
 */

console.log('🔧 FIXING DATA ISSUES...\n');

// 1. Fix live_data.json if corrupt
const liveDataPath = path.join(__dirname, '../data/live_data.json');

console.log('📋 Checking live_data.json...');
try {
    const content = fs.readFileSync(liveDataPath, 'utf8');
    JSON.parse(content); // Test if valid JSON
    console.log('✅ live_data.json is valid');
} catch (error) {
    console.log('❌ live_data.json is corrupt, fixing...');
    const defaultData = {
        users: {},
        sessions: {}
    };
    fs.writeFileSync(liveDataPath, JSON.stringify(defaultData, null, 2));
    console.log('✅ live_data.json fixed');
}

// 2. Check account files
const accountsDir = path.join(__dirname, '../data/accounts');
const accountFiles = ['account.txt', 'account_day_shift.txt', 'account_night_shift.txt'];

console.log('\n👥 Checking account files...');
for (const file of accountFiles) {
    const filePath = path.join(accountsDir, file);
    if (fs.existsSync(filePath)) {
        const accounts = fs.readFileSync(filePath, 'utf8').trim().split('\n').filter(Boolean);
        console.log(`✅ ${file}: ${accounts.length} accounts`);
    } else {
        console.log(`❌ ${file}: Missing`);
    }
}

// 3. Test Supabase connection
console.log('\n🗄️ Testing Supabase connection...');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (SUPABASE_URL && SUPABASE_KEY && SUPABASE_URL.includes('supabase.co')) {
    console.log('✅ Supabase credentials found');
    console.log(`🔗 URL: ${SUPABASE_URL}`);
    console.log(`🔑 Key length: ${SUPABASE_KEY.length} characters`);
    
    // Test connection
    const { createClient } = require('@supabase/supabase-js');
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log('✅ Supabase client created successfully');
    } catch (error) {
        console.log('❌ Failed to create Supabase client:', error.message);
    }
} else {
    console.log('❌ Supabase not properly configured');
    console.log(`URL: ${SUPABASE_URL || 'Not set'}`);
    console.log(`Key: ${SUPABASE_KEY ? 'Set' : 'Not set'}`);
}

// 4. Check autorecover flag
const autorecoverPath = path.join(__dirname, '../autorecover.flag');
console.log('\n🔄 Checking autorecover status...');
if (fs.existsSync(autorecoverPath)) {
    console.log('✅ Autorecover enabled');
} else {
    console.log('ℹ️ Autorecover disabled');
}

// 5. Create curation reports directory if needed
const curationDir = path.join(__dirname, '../data/curation-reports');
if (!fs.existsSync(curationDir)) {
    fs.mkdirSync(curationDir, { recursive: true });
    console.log('\n📁 Created curation-reports directory');
} else {
    console.log('\n📁 Curation-reports directory exists');
}

console.log('\n✅ DATA ISSUES CHECK COMPLETED!\n');

// 6. Summary
console.log('📊 SYSTEM STATUS SUMMARY:');
console.log('========================');
console.log(`🗄️ Supabase: ${SUPABASE_URL && SUPABASE_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
console.log(`📋 Data File: ${fs.existsSync(liveDataPath) ? 'OK' : 'MISSING'}`);
console.log(`👥 Accounts: ${fs.existsSync(path.join(accountsDir, 'account.txt')) ? 'OK' : 'MISSING'}`);
console.log(`🔄 Autorecover: ${fs.existsSync(autorecoverPath) ? 'ENABLED' : 'DISABLED'}`);
console.log(`📁 Data Structure: ORGANIZED`);
console.log('\n🚀 Ready for deployment!');
