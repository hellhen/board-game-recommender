-- Insert games from the existing games.json data
-- This script will populate the games table with your starter data

INSERT INTO games (id, title, players, playtime, complexity, mechanics, theme, tags, bgg_id) VALUES
-- Cascadia
(uuid_generate_v4(), 'Cascadia', '1–4 (best 2–3)', '30–45 min', 2.1, 
 ARRAY['tile-laying', 'pattern-building', 'set-collection'], 'nature', 
 ARRAY['nature', 'family', 'puzzly', 'low-conflict', 'award-winner'], NULL),

-- Calico  
(uuid_generate_v4(), 'Calico', '1–4', '30–45 min', 2.3,
 ARRAY['tile-laying', 'pattern-building'], 'cozy/cats',
 ARRAY['family', 'puzzly', 'tight'], NULL),

-- Meadow
(uuid_generate_v4(), 'Meadow', '1–4', '60–90 min', 2.6,
 ARRAY['set-collection', 'tableau'], 'nature',
 ARRAY['peaceful', 'nature', 'storytelling'], NULL),

-- Add more games from your games.json file...
-- (You'll want to run a script to convert the full JSON data)

ON CONFLICT DO NOTHING;
