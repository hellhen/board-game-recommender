import { supabase } from '../lib/supabase';
import gamesData from '../data/games.json';

/**
 * Migration script to populate Supabase with existing games data
 * Run this once after setting up your Supabase database
 */
export async function migrateGamesToSupabase() {
  console.log('Starting migration of games to Supabase...');
  
  try {
    // Transform the JSON data to match our database schema
    const gamesToInsert = gamesData.map(game => ({
      title: game.title,
      players: game.players || null,
      playtime: game.playtime || null,
      complexity: game.complexity || null,
      mechanics: game.mechanics || [],
      theme: game.theme || null,
      tags: game.tags || [],
      bgg_id: null, // We don't have BGG IDs in the current data
      description: null, // We'll add descriptions later
      image_url: null, // We'll add images later
    }));

    // Insert games in batches to avoid timeout
    const batchSize = 10;
    let insertedCount = 0;
    
    for (let i = 0; i < gamesToInsert.length; i += batchSize) {
      const batch = gamesToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('games')
        .insert(batch)
        .select();
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
        continue;
      }
      
      insertedCount += data?.length || 0;
      console.log(`Inserted batch ${i / batchSize + 1}: ${data?.length || 0} games`);
    }
    
    console.log(`Migration completed! Inserted ${insertedCount} games total.`);
    return insertedCount;
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// If running this file directly (for testing)
if (require.main === module) {
  migrateGamesToSupabase()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}
