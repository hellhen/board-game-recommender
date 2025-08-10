-- Update RLS policies to allow service role operations

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Games are publicly readable" ON games;

-- Create more permissive policies for games table
CREATE POLICY "Public read access to games" ON games
    FOR SELECT USING (true);

CREATE POLICY "Service role can manage games" ON games
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role' OR
        auth.jwt() ->> 'role' = 'authenticated' OR
        current_setting('role') = 'service_role'
    );

-- Alternatively, temporarily disable RLS for games table during data import
-- (uncomment the line below if you want to disable RLS entirely)
-- ALTER TABLE games DISABLE ROW LEVEL SECURITY;

-- Re-enable after import is complete with:
-- ALTER TABLE games ENABLE ROW LEVEL SECURITY;
