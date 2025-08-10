-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Games table - store board game information
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    bgg_id INTEGER UNIQUE, -- BoardGameGeek ID for syncing
    players TEXT, -- e.g., "2-4 (best 3)"
    playtime TEXT, -- e.g., "30-45 min"
    complexity DECIMAL(3,1), -- e.g., 2.5 (BGG weight)
    mechanics TEXT[], -- Array of mechanics
    theme TEXT,
    tags TEXT[], -- Array of tags
    description TEXT,
    image_url TEXT,
    price_estimate DECIMAL(10,2), -- Rough price estimate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User sessions table - track anonymous user sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_fingerprint TEXT UNIQUE, -- Browser fingerprint or UUID
    preferences JSONB, -- Store user preferences
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Recommendations table - store recommendation history
CREATE TABLE user_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES user_sessions(id) ON DELETE CASCADE,
    user_prompt TEXT NOT NULL,
    recommended_games UUID[], -- Array of game UUIDs
    llm_response JSONB, -- Full LLM response for analysis
    feedback_rating INTEGER CHECK (feedback_rating >= 1 AND feedback_rating <= 5),
    feedback_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game prices table - track current prices from various stores
CREATE TABLE game_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    store_name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    url TEXT,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, store_name)
);

-- Create indexes for better performance
CREATE INDEX idx_games_title ON games USING GIN (title gin_trgm_ops);
CREATE INDEX idx_games_mechanics ON games USING GIN (mechanics);
CREATE INDEX idx_games_tags ON games USING GIN (tags);
CREATE INDEX idx_games_complexity ON games (complexity);
CREATE INDEX idx_games_bgg_id ON games (bgg_id);

CREATE INDEX idx_user_recommendations_session ON user_recommendations (session_id);
CREATE INDEX idx_user_recommendations_created ON user_recommendations (created_at);

CREATE INDEX idx_game_prices_game_id ON game_prices (game_id);
CREATE INDEX idx_game_prices_updated ON game_prices (last_updated);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_games_updated_at 
    BEFORE UPDATE ON games 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_prices ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access to games and prices
CREATE POLICY "Games are publicly readable" ON games
    FOR SELECT USING (true);

CREATE POLICY "Game prices are publicly readable" ON game_prices
    FOR SELECT USING (true);

-- Users can only see their own sessions and recommendations
CREATE POLICY "Users can view their own sessions" ON user_sessions
    FOR ALL USING (session_fingerprint = current_setting('app.session_fingerprint', true));

CREATE POLICY "Users can view their own recommendations" ON user_recommendations
    FOR ALL USING (
        session_id IN (
            SELECT id FROM user_sessions 
            WHERE session_fingerprint = current_setting('app.session_fingerprint', true)
        )
    );
