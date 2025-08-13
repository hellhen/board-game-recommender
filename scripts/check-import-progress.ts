import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkImportProgress() {
  console.log('🔍 Checking import progress for games ranked 1500-2000...');
  
  try {
    // Read the 1500-2000 missing games file
    const missingGamesData = JSON.parse(fs.readFileSync('missing-games-1500-2000.json', 'utf8'));
    const targetGameIds = missingGamesData.missing_bgg_ids || [];
    
    console.log(`📋 Original missing games from 1500-2000: ${targetGameIds.length}`);
    
    // Get all games currently in database
    const { data: allGames, error } = await supabase
      .from('games')
      .select('id, bgg_id, title')
      .order('id');

    if (error) {
      console.error('Error fetching games:', error);
      return;
    }

    console.log(`📊 Total games in database: ${allGames.length}`);
    
    // Create set of BGG IDs currently in database
    const existingBggIds = new Set(
      allGames
        .filter(game => game.bgg_id)
        .map(game => game.bgg_id)
    );
    
    // Find which games from 1500-2000 range are now in database
    const importedGames = targetGameIds.filter((id: number) => existingBggIds.has(id));
    const stillMissing = targetGameIds.filter((id: number) => !existingBggIds.has(id));
    
    console.log(`\n📈 Import Results:`);
    console.log(`✅ Successfully imported: ${importedGames.length} games`);
    console.log(`❌ Still missing: ${stillMissing.length} games`);
    console.log(`📊 Progress: ${((importedGames.length / targetGameIds.length) * 100).toFixed(1)}%`);
    
    if (importedGames.length > 0) {
      console.log(`\n🎯 Sample of imported games from 1500-2000 range:`);
      
      // Get details for some of the imported games
      const sampleImported = importedGames.slice(0, 10);
      for (const bggId of sampleImported) {
        const game = allGames.find(g => g.bgg_id === bggId);
        if (game) {
          console.log(`   BGG ID: ${bggId.toString().padStart(6)} - ${game.title}`);
        }
      }
      
      if (importedGames.length > 10) {
        console.log(`   ... and ${importedGames.length - 10} more games`);
      }
    }
    
    if (stillMissing.length > 0) {
      console.log(`\n⏳ Games still to import (first 10):`);
      
      // Show original game data for missing games
      const missingGamesWithDetails = missingGamesData.missing_games || [];
      const stillMissingWithDetails = missingGamesWithDetails.filter((game: any) => 
        stillMissing.includes(game.bgg_id)
      );
      
      stillMissingWithDetails.slice(0, 10).forEach((game: any) => {
        console.log(`   #${game.rank.toString().padStart(4)} - ${game.name} (BGG ID: ${game.bgg_id})`);
      });
      
      if (stillMissing.length > 10) {
        console.log(`   ... and ${stillMissing.length - 10} more games to import`);
      }
      
      // Update the missing games file to only include what's still missing
      const updatedMissingData = {
        ...missingGamesData,
        total_missing: stillMissing.length,
        missing_bgg_ids: stillMissing,
        missing_games: stillMissingWithDetails,
        last_updated: new Date().toISOString(),
        import_progress: `${importedGames.length}/${targetGameIds.length} completed (${((importedGames.length / targetGameIds.length) * 100).toFixed(1)}%)`
      };
      
      fs.writeFileSync('missing-games-1500-2000.json', JSON.stringify(updatedMissingData, null, 2));
      console.log(`\n💾 Updated missing-games-1500-2000.json with remaining ${stillMissing.length} games`);
    }
    
    console.log(`\n🚀 Next steps:`);
    if (stillMissing.length > 0) {
      console.log(`1. Run "npm run import:careful" again to import the remaining ${stillMissing.length} games`);
      console.log(`2. The script will pick up where it left off`);
    } else {
      console.log(`🎉 All games from 1500-2000 range have been imported!`);
      console.log(`You now have complete coverage of games ranked 1500-2000`);
    }
    
  } catch (error) {
    console.error('❌ Error checking import progress:', error);
  }
}

// Handle script execution
if (require.main === module) {
  checkImportProgress()
    .then(() => {
      console.log('\n✅ Import progress check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Check failed:', error);
      process.exit(1);
    });
}
