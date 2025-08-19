-- Fix RLS policies for game_prices table to allow price updates

-- Option 1: Add INSERT policy (recommended for production)
CREATE POLICY "Allow public inserts to game_prices" ON game_prices
FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public updates to game_prices" ON game_prices
FOR UPDATE USING (true) WITH CHECK (true);

-- Option 2: Temporarily disable RLS (for testing only)
-- Uncomment the line below if you want to disable RLS entirely for testing
-- ALTER TABLE game_prices DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS later (if you used option 2):
-- ALTER TABLE game_prices ENABLE ROW LEVEL SECURITY;
