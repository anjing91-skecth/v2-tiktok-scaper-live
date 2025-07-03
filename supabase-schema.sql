-- ============================================
-- SUPABASE DATABASE SCHEMA
-- TikTok Live Scraper v2 Data Persistence
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- MAIN TABLE: live_sessions
-- ============================================
CREATE TABLE live_sessions (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    
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
    leaderboard_json TEXT, -- JSON string of leaderboard object
    gifts_json TEXT,       -- JSON string of gifts array
    session_notes_json TEXT, -- JSON string of session notes
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_live_sessions_username ON live_sessions(username);
CREATE INDEX idx_live_sessions_session_id ON live_sessions(session_id);
CREATE INDEX idx_live_sessions_timestamp_start ON live_sessions(timestamp_start);
CREATE INDEX idx_live_sessions_status ON live_sessions(status);
CREATE INDEX idx_live_sessions_room_id ON live_sessions(room_id);
CREATE INDEX idx_live_sessions_created_at ON live_sessions(created_at);

-- ============================================
-- ROW LEVEL SECURITY (Optional)
-- ============================================
-- Enable RLS
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for service role
CREATE POLICY "Enable all operations for service role" ON live_sessions
    FOR ALL 
    USING (true);

-- ============================================
-- VIEWS FOR EASY QUERYING
-- ============================================

-- View for active sessions
CREATE VIEW active_sessions AS
SELECT 
    username,
    session_id,
    room_id,
    timestamp_start,
    duration,
    viewer_count,
    peak_viewer,
    total_diamond,
    created_at
FROM live_sessions
WHERE status = 'active'
ORDER BY created_at DESC;

-- View for session summary by username
CREATE VIEW session_summary AS
SELECT 
    username,
    COUNT(*) as total_sessions,
    SUM(total_diamond) as total_diamonds,
    MAX(peak_viewer) as max_viewers,
    AVG(peak_viewer) as avg_viewers,
    MIN(created_at) as first_session,
    MAX(created_at) as last_session
FROM live_sessions
GROUP BY username
ORDER BY total_diamonds DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_live_sessions_updated_at 
    BEFORE UPDATE ON live_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE QUERIES
-- ============================================

-- Get all sessions for a specific user
-- SELECT * FROM live_sessions WHERE username = 'tiramisu_dance' ORDER BY created_at DESC;

-- Get top spenders across all sessions
-- SELECT username, total_diamond FROM live_sessions ORDER BY total_diamond DESC LIMIT 10;

-- Get sessions from last 24 hours
-- SELECT * FROM live_sessions WHERE created_at > NOW() - INTERVAL '24 hours';

-- Get total diamonds per user
-- SELECT username, SUM(total_diamond) as total FROM live_sessions GROUP BY username ORDER BY total DESC;

-- ============================================
-- BACKUP & MAINTENANCE
-- ============================================

-- Create backup function
CREATE OR REPLACE FUNCTION backup_live_sessions(backup_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(total_rows BIGINT) AS $$
BEGIN
    -- This could be extended to create backup tables
    RETURN QUERY SELECT COUNT(*) FROM live_sessions WHERE DATE(created_at) = backup_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- NOTES
-- ============================================
-- 1. This schema preserves all existing data structure
-- 2. JSON fields maintain flexibility for complex objects
-- 3. Indexes ensure fast queries
-- 4. Views provide easy access to common data
-- 5. RLS provides security if needed
-- 6. Triggers maintain data integrity
