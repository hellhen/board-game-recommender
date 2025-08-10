import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Please check your .env.local file for:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Simple BGG import that works with RLS by using a different approach
 */
async function simpleBGGImport(count: number = 10) {
  console.log(`🎲 Starting simple BGG import with ${count} games...`);
  console.log('This version manually creates game data to work around RLS issues.\n');

  // Hardcoded popular games data that we know are excellent
  const popularGames = [
    {
      title: "Gloomhaven",
      bgg_id: 174430,
      players: "1–4 (best 2–3)",
      playtime: "60–120 min",
      complexity: 3.9,
      mechanics: ["campaign", "cooperative", "variable-powers"],
      theme: "fantasy",
      tags: ["epic", "story-driven", "heavy", "coop"],
      description: "A campaign-driven dungeon crawler with tactical combat and branching narratives."
    },
    {
      title: "Terraforming Mars",
      bgg_id: 167791,
      players: "1–5 (best 3–4)",
      playtime: "90–120 min",
      complexity: 3.3,
      mechanics: ["engine-building", "hand-management", "tile-laying"],
      theme: "space",
      tags: ["engine-building", "satisfying", "space", "strategy"],
      description: "Build an engine of cards to terraform Mars and compete for the best corporation."
    },
    {
      title: "7 Wonders Duel",
      bgg_id: 173346,
      players: "2",
      playtime: "30 min",
      complexity: 2.2,
      mechanics: ["drafting", "set-collection", "variable-powers"],
      theme: "civilization",
      tags: ["two-player", "quick", "civilizations", "drafting"],
      description: "Lead one of the seven great cities of the Ancient World in this two-player adaptation."
    },
    {
      title: "Azul",
      bgg_id: 158899,
      players: "2–4",
      playtime: "30–45 min",
      complexity: 1.8,
      mechanics: ["pattern-building", "tile-laying", "set-collection"],
      theme: "abstract",
      tags: ["family", "beautiful", "accessible", "satisfying"],
      description: "A beautiful tile-laying game about decorating Portuguese palaces."
    },
    {
      title: "Splendor",
      bgg_id: 148228,
      players: "2–4",
      playtime: "30 min",
      complexity: 1.8,
      mechanics: ["engine-building", "set-collection"],
      theme: "renaissance/gems",
      tags: ["family", "gateway", "engine-building", "quick"],
      description: "Build a gem trading empire in this elegant engine-building game."
    },
    {
      title: "Wingspan",
      bgg_id: 266192,
      players: "1–5 (best 2–4)",
      playtime: "40–70 min", 
      complexity: 2.4,
      mechanics: ["engine-building", "tableau", "card-play"],
      theme: "nature/birds",
      tags: ["nature", "engine-building", "beautiful", "relaxing"],
      description: "A competitive, medium-weight, card-driven, engine-building board game about birds."
    },
    {
      title: "Ticket to Ride",
      bgg_id: 9209,
      players: "2–5 (best 3–4)",
      playtime: "30–60 min",
      complexity: 1.8,
      mechanics: ["route-building", "set-collection", "hand-management"],
      theme: "trains",
      tags: ["family", "accessible", "route-building", "classic"],
      description: "A cross-country train adventure where players collect train cards to claim railway routes."
    },
    {
      title: "King of Tokyo",
      bgg_id: 70323,
      players: "2–6 (best 4–5)",
      playtime: "30 min",
      complexity: 1.5,
      mechanics: ["dice-rolling", "variable-powers"],
      theme: "monsters",
      tags: ["party", "dice", "monsters", "fun"],
      description: "Mutant monsters compete to destroy Tokyo in this dice-rolling game."
    },
    {
      title: "Pandemic",
      bgg_id: 30549,
      players: "2–4 (best 4)",
      playtime: "45 min",
      complexity: 2.4,
      mechanics: ["cooperative", "hand-management", "set-collection"],
      theme: "medical",
      tags: ["coop", "classic", "challenging", "teamwork"],
      description: "Work together as a team of specialists to save humanity from four deadly diseases."
    },
    {
      title: "Catan",
      bgg_id: 13,
      players: "3–4 (best 4)",
      playtime: "60–90 min",
      complexity: 2.3,
      mechanics: ["trading", "dice-rolling", "route-building"],
      theme: "civilization",
      tags: ["classic", "gateway", "trading", "iconic"],
      description: "The classic game of building settlements and cities on the island of Catan."
    }
  ];

  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < Math.min(count, popularGames.length); i++) {
    const game = popularGames[i];

    try {
      // Check if game already exists
      const { data: existing } = await supabase
        .from('games')
        .select('id')
        .or(`title.eq.${game.title},bgg_id.eq.${game.bgg_id}`)
        .single();

      if (existing) {
        console.log(`⏭️  ${game.title} already exists, skipping...`);
        skippedCount++;
        continue;
      }

      // Try to insert the game
      const { data, error } = await supabase
        .from('games')
        .insert(game)
        .select();

      if (error) {
        console.error(`❌ Error inserting ${game.title}:`, error.message);
        if (error.message.includes('row-level security')) {
          console.log('\n🔒 RLS is still blocking inserts. Please use the Supabase dashboard to:');
          console.log('   ALTER TABLE games DISABLE ROW LEVEL SECURITY;');
          console.log('   Then run this script again.');
          break;
        }
      } else {
        console.log(`✅ Added: ${game.title}`);
        insertedCount++;
      }

      // Small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error) {
      console.error(`❌ Failed to process ${game.title}:`, error);
    }
  }

  console.log(`\n🎉 Simple import completed!`);
  console.log(`📊 Results: ${insertedCount} added, ${skippedCount} skipped`);
  
  if (insertedCount > 0) {
    console.log('\n✨ Great! Your database now has more high-quality games.');
    console.log('🎯 Try making a recommendation to test the expanded collection!');
    console.log('📈 Check stats with: npm run db:manage stats');
  }
}

// CLI execution
const gameCount = parseInt(process.argv[2]) || 10;

simpleBGGImport(gameCount)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Simple import failed:', error);
    process.exit(1);
  });
