import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupMissingGamesFile() {
  console.log('🧹 Cleaning up missing-games-1500-2000.json file...');
  
  try {
    // Read the current missing games file
    const missingGamesData = JSON.parse(fs.readFileSync('missing-games-1500-2000.json', 'utf8'));
    const originalMissingIds = missingGamesData.missing_bgg_ids || [];
    
    console.log(`📋 Currently listed as missing: ${originalMissingIds.length} games`);
    
    // Get all BGG IDs currently in database
    const { data: existingGames, error } = await supabase
      .from('games')
      .select('bgg_id')
      .not('bgg_id', 'is', null);

    if (error) {
      console.error('Error fetching games:', error);
      return;
    }

    const existingBggIds = new Set(existingGames.map(game => game.bgg_id));
    console.log(`📊 Found ${existingBggIds.size} games with BGG IDs in database`);
    
    // Filter out games that are already in database
    const actuallyMissingIds = originalMissingIds.filter(id => !existingBggIds.has(id));
    const alreadyImportedIds = originalMissingIds.filter(id => existingBggIds.has(id));
    
    console.log(`✅ Games already imported: ${alreadyImportedIds.length}`);
    console.log(`❌ Games still missing: ${actuallyMissingIds.length}`);
    
    if (alreadyImportedIds.length > 0) {
      console.log(`🎯 Sample of already imported games (first 10):`);
      alreadyImportedIds.slice(0, 10).forEach(id => {
        console.log(`   BGG ID: ${id}`);
      });
    }
    
    // Update missing games data
    const actuallyMissingGames = missingGamesData.missing_games?.filter(game => 
      actuallyMissingIds.includes(game.bgg_id)
    ) || [];
    
    const updatedMissingData = {
      ...missingGamesData,
      total_missing: actuallyMissingIds.length,
      missing_bgg_ids: actuallyMissingIds,
      missing_games: actuallyMissingGames,
      last_cleaned: new Date().toISOString(),
      cleanup_summary: {
        originally_missing: originalMissingIds.length,
        already_imported: alreadyImportedIds.length,
        still_missing: actuallyMissingIds.length
      }
    };
    
    // Backup the original file
    fs.writeFileSync('missing-games-1500-2000.json.backup', JSON.stringify(missingGamesData, null, 2));
    console.log(`💾 Backed up original file as missing-games-1500-2000.json.backup`);
    
    // Write the cleaned file
    fs.writeFileSync('missing-games-1500-2000.json', JSON.stringify(updatedMissingData, null, 2));
    console.log(`💾 Updated missing-games-1500-2000.json with ${actuallyMissingIds.length} remaining games`);
    
    if (actuallyMissingIds.length === 0) {
      console.log(`\n🎉 All games from 1500-2000 range are already imported!`);
      console.log(`Your database now has complete coverage of games ranked 1500-2000`);
    } else {
      console.log(`\n🚀 Ready to import remaining ${actuallyMissingIds.length} games`);
      console.log(`Run "npm run import:careful" to import the remaining games`);
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up missing games file:', error);
  }
}

// Handle script execution
if (require.main === module) {
  cleanupMissingGamesFile()
    .then(() => {
      console.log('\n✅ Cleanup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    });
}
