-- Add missing columns to game_prices table for purchase links feature
-- Run this migration to add support for affiliate links, availability tracking, and scraping confidence

-- Add new columns to game_prices table
ALTER TABLE game_prices 
ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'unknown' 
    CHECK (availability IN ('in-stock', 'out-of-stock', 'unknown'));

ALTER TABLE game_prices 
ADD COLUMN IF NOT EXISTS affiliate_url TEXT;

ALTER TABLE game_prices 
ADD COLUMN IF NOT EXISTS scrape_confidence DECIMAL(3,2) DEFAULT 0.0 
    CHECK (scrape_confidence >= 0.0 AND scrape_confidence <= 1.0);

-- Update the unique constraint to ensure we can have one price per game per store
-- (this should already exist but let's make sure)
DO $$ 
BEGIN
    -- Drop constraint if it exists with old name
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'game_prices_game_id_store_name_key' 
               AND table_name = 'game_prices') THEN
        ALTER TABLE game_prices DROP CONSTRAINT game_prices_game_id_store_name_key;
    END IF;
    
    -- Add the constraint with a clear name
    ALTER TABLE game_prices 
    ADD CONSTRAINT unique_game_store_price 
    UNIQUE (game_id, store_name);
    
EXCEPTION WHEN duplicate_object THEN 
    -- Constraint already exists, that's fine
    NULL;
END $$;

-- Add index for better performance on availability queries
CREATE INDEX IF NOT EXISTS idx_game_prices_availability 
ON game_prices (availability);

-- Add index for confidence-based queries
CREATE INDEX IF NOT EXISTS idx_game_prices_confidence 
ON game_prices (scrape_confidence);

-- Add composite index for finding best prices
CREATE INDEX IF NOT EXISTS idx_game_prices_game_price_availability 
ON game_prices (game_id, price, availability);

-- Update the updated_at column default for new rows
ALTER TABLE game_prices 
ALTER COLUMN last_updated SET DEFAULT NOW();

-- Create a view for easily getting the best prices per game
CREATE OR REPLACE VIEW game_best_prices AS
SELECT DISTINCT ON (gp.game_id)
    gp.game_id,
    g.title,
    gp.store_name,
    gp.price,
    gp.currency,
    gp.url,
    gp.affiliate_url,
    gp.availability,
    gp.scrape_confidence,
    gp.last_updated
FROM game_prices gp
JOIN games g ON g.id = gp.game_id
WHERE gp.availability = 'in-stock' OR gp.availability = 'unknown'
ORDER BY gp.game_id, gp.price ASC, gp.scrape_confidence DESC;

-- Create a view for price statistics
CREATE OR REPLACE VIEW price_statistics AS
SELECT 
    COUNT(DISTINCT game_id) as total_games_with_prices,
    AVG(price) as average_price,
    MIN(price) as min_price,
    MAX(price) as max_price,
    COUNT(*) as total_price_records,
    store_name,
    COUNT(*) FILTER (WHERE availability = 'in-stock') as in_stock_count,
    COUNT(*) FILTER (WHERE availability = 'out-of-stock') as out_of_stock_count,
    AVG(scrape_confidence) as average_confidence,
    MAX(last_updated) as last_updated
FROM game_prices
GROUP BY store_name;

-- Grant necessary permissions (adjust as needed for your setup)
-- These are for the public role that Supabase uses
GRANT SELECT ON game_best_prices TO public;
GRANT SELECT ON price_statistics TO public;

-- Add comment to document the schema
COMMENT ON TABLE game_prices IS 'Stores current pricing information for board games from various online retailers';
COMMENT ON COLUMN game_prices.availability IS 'Current stock status: in-stock, out-of-stock, or unknown';
COMMENT ON COLUMN game_prices.affiliate_url IS 'URL with affiliate tracking parameters for monetization';
COMMENT ON COLUMN game_prices.scrape_confidence IS 'Confidence score (0.0-1.0) for how well the scraped product matches the game';
