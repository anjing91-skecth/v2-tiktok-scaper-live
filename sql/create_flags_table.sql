-- Create flags table for persistent configuration
-- This table stores system flags that persist across deployments and updates

CREATE TABLE IF NOT EXISTS flags (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_flags_name ON flags(name);

-- Insert default flags
INSERT INTO flags (name, value, description) VALUES 
('autorecover', 'false', 'Auto-recovery system flag - enables automatic monitoring restart after server restarts')
ON CONFLICT (name) DO NOTHING;

-- Create trigger to update updated_at automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_flags_updated_at 
    BEFORE UPDATE ON flags 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO flags (name, value, description) VALUES 
('maintenance_mode', 'false', 'System maintenance mode flag'),
('debug_mode', 'false', 'Debug logging mode flag'),
('rate_limit_strict', 'false', 'Strict rate limiting mode flag')
ON CONFLICT (name) DO NOTHING;

-- Grant permissions (adjust based on your RLS policies)
-- ALTER TABLE flags ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow service role full access" ON flags FOR ALL USING (true);
