import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Database management utilities for the BGG integration
 */

export async function checkDatabaseStats(): Promise<void> {
  console.log('📊 Checking database statistics...\n');

  try {
    // Count total games
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    // Count games with BGG IDs
    const { count: bggGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('bgg_id', 'is', null);

    // Count games with images
    const { count: gamesWithImages } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('image_url', 'is', null);

    // Get complexity distribution
    const { data: complexityStats } = await supabase
      .from('games')
      .select('complexity')
      .not('complexity', 'is', null);

    const complexityDistribution = {
      light: complexityStats?.filter(g => g.complexity <= 2.0).length || 0,
      medium: complexityStats?.filter(g => g.complexity > 2.0 && g.complexity <= 3.5).length || 0,
      heavy: complexityStats?.filter(g => g.complexity > 3.5).length || 0
    };

    // Get most common themes
    const { data: themes } = await supabase
      .from('games')
      .select('theme')
      .not('theme', 'is', null);

    const themeCount: { [key: string]: number } = {};
    themes?.forEach(game => {
      if (game.theme) {
        themeCount[game.theme] = (themeCount[game.theme] || 0) + 1;
      }
    });

    const topThemes = Object.entries(themeCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    // Display results
    console.log(`📚 Total games in database: ${totalGames}`);
    console.log(`🎲 Games with BGG data: ${bggGames} (${Math.round((bggGames || 0) * 100 / (totalGames || 1))}%)`);
    console.log(`🖼️  Games with images: ${gamesWithImages} (${Math.round((gamesWithImages || 0) * 100 / (totalGames || 1))}%)`);
    
    console.log('\n📈 Complexity Distribution:');
    console.log(`  Light (≤2.0): ${complexityDistribution.light} games`);
    console.log(`  Medium (2.1-3.5): ${complexityDistribution.medium} games`);
    console.log(`  Heavy (3.6+): ${complexityDistribution.heavy} games`);

    console.log('\n🏷️  Top Themes:');
    topThemes.forEach(([theme, count], index) => {
      console.log(`  ${index + 1}. ${theme}: ${count} games`);
    });

  } catch (error) {
    console.error('Error checking database stats:', error);
  }
}

export async function cleanupDuplicateGames(): Promise<void> {
  console.log('🧹 Cleaning up duplicate games...\n');

  try {
    // Find games with duplicate titles
    const { data: duplicates } = await supabase
      .from('games')
      .select('title, id, bgg_id, created_at')
      .order('title');

    if (!duplicates) return;

    const titleGroups: { [key: string]: typeof duplicates } = {};
    duplicates.forEach(game => {
      if (!titleGroups[game.title]) {
        titleGroups[game.title] = [];
      }
      titleGroups[game.title].push(game);
    });

    let deletedCount = 0;

    for (const [title, games] of Object.entries(titleGroups)) {
      if (games.length > 1) {
        console.log(`Found ${games.length} copies of "${title}"`);
        
        // Keep the one with BGG ID, or the newest one
        const gamesToKeep = games.filter(g => g.bgg_id !== null);
        const gameToKeep = gamesToKeep.length > 0 
          ? gamesToKeep[0] 
          : games.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        
        const gamesToDelete = games.filter(g => g.id !== gameToKeep.id);
        
        for (const gameToDelete of gamesToDelete) {
          const { error } = await supabase
            .from('games')
            .delete()
            .eq('id', gameToDelete.id);
          
          if (error) {
            console.error(`Error deleting duplicate of "${title}":`, error);
          } else {
            console.log(`  ✓ Deleted duplicate: ${gameToDelete.id}`);
            deletedCount++;
          }
        }
      }
    }

    console.log(`\n🎉 Cleanup complete! Removed ${deletedCount} duplicate games.`);

  } catch (error) {
    console.error('Error cleaning up duplicates:', error);
  }
}

export async function updateGameMetadata(): Promise<void> {
  console.log('🔄 Updating game metadata...\n');

  try {
    // Find games without proper player count formatting
    const { data: gamesNeedingUpdate } = await supabase
      .from('games')
      .select('id, title, players')
      .or('players.is.null,players.eq.');

    if (!gamesNeedingUpdate || gamesNeedingUpdate.length === 0) {
      console.log('No games need metadata updates.');
      return;
    }

    let updatedCount = 0;

    for (const game of gamesNeedingUpdate) {
      // Generate default player count if missing
      const defaultPlayers = '2–4 (best 3)';
      
      const { error } = await supabase
        .from('games')
        .update({ players: defaultPlayers })
        .eq('id', game.id);

      if (error) {
        console.error(`Error updating "${game.title}":`, error);
      } else {
        console.log(`✓ Updated player count for: ${game.title}`);
        updatedCount++;
      }
    }

    console.log(`\n🎉 Updated metadata for ${updatedCount} games.`);

  } catch (error) {
    console.error('Error updating metadata:', error);
  }
}

// CLI execution
async function main() {
  const command = process.argv[2];

  switch (command) {
    case 'stats':
      await checkDatabaseStats();
      break;
    case 'cleanup':
      await cleanupDuplicateGames();
      break;
    case 'update':
      await updateGameMetadata();
      break;
    case 'all':
      await checkDatabaseStats();
      await cleanupDuplicateGames();
      await updateGameMetadata();
      await checkDatabaseStats();
      break;
    default:
      console.log('Usage: npm run db:manage <command>');
      console.log('Commands:');
      console.log('  stats   - Show database statistics');
      console.log('  cleanup - Remove duplicate games');
      console.log('  update  - Update missing metadata');
      console.log('  all     - Run all management tasks');
      break;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Database management failed:', error);
      process.exit(1);
    });
}
