-- Temporarily allow public insertions for games (for migration only)
DROP POLICY IF EXISTS "Allow public game inserts" ON games;
CREATE POLICY "Allow public game inserts" ON games
    FOR INSERT WITH CHECK (true);

-- Insert games data from JSON
INSERT INTO games (title, players, playtime, complexity, mechanics, theme, tags) VALUES
('Cascadia', '1–4 (best 2–3)', '30–45 min', 2.1, ARRAY['tile-laying', 'pattern-building', 'set-collection'], 'nature', ARRAY['nature', 'family', 'puzzly', 'low-conflict', 'award-winner']),
('Calico', '1–4', '30–45 min', 2.3, ARRAY['tile-laying', 'pattern-building'], 'cozy/cats', ARRAY['family', 'puzzly', 'tight']),
('Meadow', '1–4', '60–90 min', 2.6, ARRAY['set-collection', 'tableau'], 'nature', ARRAY['peaceful', 'nature', 'storytelling']),
('Parks', '1–5', '40–70 min', 2.3, ARRAY['set-collection', 'worker-placement'], 'nature', ARRAY['nature', 'family', 'beautiful']),
('Wingspan', '1–5', '40–70 min', 2.4, ARRAY['tableau-building', 'engine-building'], 'nature/birds', ARRAY['nature', 'engine', 'beautiful', 'award-winner']),
('Azul', '2–4', '30–45 min', 2.3, ARRAY['tile-laying', 'pattern-building'], 'abstract/tiles', ARRAY['family', 'abstract', 'beautiful', 'award-winner']),
('Splendor', '2–4', '30 min', 2.0, ARRAY['set-collection', 'engine-building'], 'renaissance/gems', ARRAY['gateway', 'engine', 'quick']),
('Ticket to Ride', '2–5', '30–60 min', 1.8, ARRAY['set-collection', 'route-building'], 'trains', ARRAY['gateway', 'family', 'classic']),
('King of Tokyo', '2–6', '30 min', 2.0, ARRAY['dice-rolling', 'variable-powers'], 'monsters/tokyo', ARRAY['family', 'dice', 'fun', 'monsters']),
('7 Wonders', '2–7', '30 min', 2.3, ARRAY['drafting', 'tableau-building'], 'ancient-civilizations', ARRAY['drafting', 'civilization', 'simultaneous']),
('Catan', '3–4', '60–120 min', 2.3, ARRAY['dice-rolling', 'trading', 'modular-board'], 'medieval/exploration', ARRAY['classic', 'trading', 'gateway', 'variable-setup']),
('Dominion', '2–4', '30 min', 2.3, ARRAY['deck-building'], 'medieval', ARRAY['deck-building', 'classic', 'expandable']),
('Pandemic', '2–4', '45 min', 2.4, ARRAY['cooperative', 'hand-management'], 'medical/diseases', ARRAY['cooperative', 'tense', 'challenging']),
('Codenames', '2–8+', '15 min', 1.3, ARRAY['word-game', 'team-play'], 'spies', ARRAY['party', 'word', 'team', 'social']),
('Just One', '3–8', '20 min', 1.2, ARRAY['word-game', 'cooperative'], 'word-guessing', ARRAY['party', 'cooperative', 'hilarious', 'simple']),
('Wavelength', '2–12', '45 min', 1.8, ARRAY['team-play', 'communication'], 'abstract/telepathy', ARRAY['party', 'team', 'creative', 'discussion']),
('Pipeline', '2–4', '60–120 min', 3.8, ARRAY['economic', 'network-building'], 'oil-industry', ARRAY['heavy', 'economic', 'thinky', 'optimization']),
('Great Western Trail', '1–4', '75–150 min', 3.7, ARRAY['deck-building', 'point-to-point'], 'western/cattle', ARRAY['heavy', 'deck-building', 'complex', 'rewarding']),
('Brass: Birmingham', '2–4', '60–120 min', 3.9, ARRAY['economic', 'network-building'], 'industrial-revolution', ARRAY['heavy', 'economic', 'beer', 'iron', 'showpiece']),
('Food Chain Magnate', '2–5', '120–240 min', 4.2, ARRAY['economic', 'route-building'], 'business/restaurants', ARRAY['heavy', 'economic', 'unforgiving', 'deep-cut']),
('Planet', '2–4', '30–45 min', 2.4, ARRAY['tile-laying', 'pattern-building'], 'planet-creation', ARRAY['nature', 'unique', 'beautiful', 'showpiece']),
('Trailblazers', '2–4', '45–60 min', 2.7, ARRAY['tile-laying', 'network-building'], 'hiking/nature', ARRAY['nature', 'indie', 'deep-cut']),
('Floriferous', '1–4', '20–40 min', 2.0, ARRAY['set-collection', 'hand-management'], 'flowers/gardening', ARRAY['nature', 'beautiful', 'relaxing', 'deep-cut']);

-- Remove the temporary insert policy after migration
DROP POLICY IF EXISTS "Allow public game inserts" ON games;
