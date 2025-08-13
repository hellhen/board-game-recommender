-- Create shared_recommendations table for storing shareable recommendation links
CREATE TABLE IF NOT EXISTS shared_recommendations (
    id SERIAL PRIMARY KEY,
    share_id VARCHAR(8) NOT NULL UNIQUE,
    title TEXT,
    prompt TEXT NOT NULL,
    recommendations JSONB NOT NULL,
    metadata JSONB,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shared_recommendations_share_id ON shared_recommendations(share_id);
CREATE INDEX IF NOT EXISTS idx_shared_recommendations_created_at ON shared_recommendations(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE shared_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read shared recommendations (they're meant to be public)
CREATE POLICY "Anyone can read shared recommendations" ON shared_recommendations
    FOR SELECT USING (true);

-- Policy: Allow anyone to create shared recommendations (no auth required for sharing)
CREATE POLICY "Anyone can create shared recommendations" ON shared_recommendations
    FOR INSERT WITH CHECK (true);

-- Policy: Allow anyone to update view counts (for tracking views)
CREATE POLICY "Anyone can update view counts" ON shared_recommendations
    FOR UPDATE USING (true) WITH CHECK (true);

-- Policy: Allow cleanup of old recommendations (older than 30 days)
CREATE POLICY "Allow cleanup of old recommendations" ON shared_recommendations
    FOR DELETE USING (created_at < NOW() - INTERVAL '30 days');

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_shared_recommendations_updated_at 
    BEFORE UPDATE ON shared_recommendations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
