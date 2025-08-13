-- Add shared recommendations table for shareable links
CREATE TABLE shared_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    share_id TEXT UNIQUE NOT NULL, -- Short, URL-friendly ID
    title TEXT, -- Optional title for the share
    original_prompt TEXT NOT NULL,
    recommendations JSONB NOT NULL, -- Full recommendation response
    metadata JSONB, -- Additional metadata from the recommendation
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE, -- Optional expiration
    is_public BOOLEAN DEFAULT true
);

-- Create index for fast lookups by share_id
CREATE INDEX idx_shared_recommendations_share_id ON shared_recommendations (share_id);
CREATE INDEX idx_shared_recommendations_created ON shared_recommendations (created_at);

-- Enable RLS
ALTER TABLE shared_recommendations ENABLE ROW LEVEL SECURITY;

-- Policy: Public shares are readable by everyone
CREATE POLICY "Public shared recommendations are readable" ON shared_recommendations
    FOR SELECT USING (is_public = true AND (expires_at IS NULL OR expires_at > NOW()));

-- Policy: Anyone can insert shared recommendations (for anonymous sharing)
CREATE POLICY "Anyone can create shared recommendations" ON shared_recommendations
    FOR INSERT WITH CHECK (true);

-- Function to generate short, URL-friendly share IDs
CREATE OR REPLACE FUNCTION generate_share_id()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    -- Generate 8-character random string
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(share_id_param TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE shared_recommendations 
    SET view_count = view_count + 1 
    WHERE share_id = share_id_param;
END;
$$ LANGUAGE plpgsql;
