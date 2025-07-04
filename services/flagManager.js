const supabaseClient = require('../supabase-client');

// System flags that persist across updates
const SYSTEM_FLAGS = {
    AUTORECOVER: 'autorecover',
    MONITORING_ACTIVE: 'monitoring_active',
    BACKUP_ENABLED: 'backup_enabled',
    RATE_LIMIT_ENABLED: 'rate_limit_enabled'
};

// In-memory flag cache
let flagCache = {};

// Initialize flag system
async function initializeFlagSystem() {
    console.log('🏁 Initializing flag system...');
    
    try {
        // Load flags from Supabase
        const flags = await loadFlagsFromSupabase();
        flagCache = flags;
        
        // Load legacy file-based flags for migration
        await migrateLegacyFlags();
        
        console.log('✅ Flag system initialized successfully');
        console.log('📋 Current flags:', flagCache);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize flag system:', error);
        
        // Fallback to file-based flags
        await loadLegacyFlags();
        return false;
    }
}

// Load flags from Supabase
async function loadFlagsFromSupabase() {
    if (!supabaseClient.useSupabase()) {
        return {};
    }
    
    try {
        const flags = await supabaseClient.loadSystemFlags();
        return flags || {};
    } catch (error) {
        console.error('❌ Error loading flags from Supabase:', error);
        return {};
    }
}

// Save flags to Supabase
async function saveFlagsToSupabase() {
    if (!supabaseClient.useSupabase()) {
        return false;
    }
    
    try {
        await supabaseClient.saveSystemFlags(flagCache);
        return true;
    } catch (error) {
        console.error('❌ Error saving flags to Supabase:', error);
        return false;
    }
}

// Get flag value
function getFlag(flagName) {
    return flagCache[flagName] || false;
}

// Set flag value
async function setFlag(flagName, value) {
    const oldValue = flagCache[flagName];
    flagCache[flagName] = value;
    
    // Save to Supabase
    const saved = await saveFlagsToSupabase();
    
    // Also save to file as backup
    await saveLegacyFlag(flagName, value);
    
    console.log(`🏁 Flag updated: ${flagName} = ${value} (was: ${oldValue})`);
    
    return saved;
}

// Load legacy file-based flags
async function loadLegacyFlags() {
    const fs = require('fs');
    const path = require('path');
    
    const autorecoverFile = path.join(process.cwd(), 'autorecover.flag');
    
    if (fs.existsSync(autorecoverFile)) {
        flagCache[SYSTEM_FLAGS.AUTORECOVER] = true;
        console.log('📂 Loaded legacy autorecover flag');
    }
}

// Migrate legacy flags to Supabase
async function migrateLegacyFlags() {
    const fs = require('fs');
    const path = require('path');
    
    const autorecoverFile = path.join(process.cwd(), 'autorecover.flag');
    
    // Check if legacy flag exists and not already in Supabase
    if (fs.existsSync(autorecoverFile) && !flagCache[SYSTEM_FLAGS.AUTORECOVER]) {
        console.log('🔄 Migrating legacy autorecover flag to Supabase...');
        await setFlag(SYSTEM_FLAGS.AUTORECOVER, true);
        
        // Remove legacy file after successful migration
        try {
            fs.unlinkSync(autorecoverFile);
            console.log('✅ Legacy autorecover flag migrated and removed');
        } catch (error) {
            console.error('⚠️ Failed to remove legacy flag file:', error);
        }
    }
}

// Save legacy flag (backup)
async function saveLegacyFlag(flagName, value) {
    const fs = require('fs');
    const path = require('path');
    
    if (flagName === SYSTEM_FLAGS.AUTORECOVER) {
        const autorecoverFile = path.join(process.cwd(), 'autorecover.flag');
        
        if (value) {
            fs.writeFileSync(autorecoverFile, 'on');
        } else {
            if (fs.existsSync(autorecoverFile)) {
                fs.unlinkSync(autorecoverFile);
            }
        }
    }
}

// Get all flags
function getAllFlags() {
    return { ...flagCache };
}

// Reset all flags
async function resetAllFlags() {
    flagCache = {};
    await saveFlagsToSupabase();
    
    // Clean up legacy files
    const fs = require('fs');
    const path = require('path');
    const autorecoverFile = path.join(process.cwd(), 'autorecover.flag');
    
    if (fs.existsSync(autorecoverFile)) {
        fs.unlinkSync(autorecoverFile);
    }
    
    console.log('🔄 All flags reset');
}

module.exports = {
    SYSTEM_FLAGS,
    initializeFlagSystem,
    getFlag,
    setFlag,
    getAllFlags,
    resetAllFlags,
    loadFlagsFromSupabase,
    saveFlagsToSupabase
};
