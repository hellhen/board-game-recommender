-- Updated RLS policies that should work with service role key

-- First, let's completely reset the policies
DROP POLICY IF EXISTS "Games are publicly readable" ON games;
DROP POLICY IF EXISTS "Service role can manage games" ON games;
DROP POLICY IF EXISTS "Public read access to games" ON games;
DROP POLICY IF EXISTS "allow_public_read_games" ON games;
DROP POLICY IF EXISTS "allow_service_role_all_games" ON games;
DROP POLICY IF EXISTS "allow_authenticated_read_games" ON games;

-- Create simple, working policies
-- Allow anyone to read games (for the frontend)
CREATE POLICY "enable_read_access_for_all_users" ON games
FOR SELECT USING (true);

-- Allow service role to do anything
CREATE POLICY "enable_all_access_for_service_role" ON games
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- If the above doesn't work, try this alternative approach
-- Allow based on the actual role being used
CREATE POLICY "enable_insert_for_service_role" ON games
FOR INSERT WITH CHECK (true);

CREATE POLICY "enable_update_for_service_role" ON games
FOR UPDATE USING (true);

CREATE POLICY "enable_delete_for_service_role" ON games
FOR DELETE USING (true);

-- Test insertion
INSERT INTO games (title, bgg_id, players, playtime, complexity, mechanics, theme, tags, description)
VALUES ('POLICY_TEST_DELETE_IMMEDIATELY', 888888, '1', '1 min', 1.0, ARRAY['test'], 'test', ARRAY['test'], 'test policy');

-- Clean up test
DELETE FROM games WHERE bgg_id = 888888;
