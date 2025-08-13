import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugDatabaseState() {
  console.log('🔍 Debugging database state and duplicate key issue...\n');
  
  try {
    // Get total count
    const { count, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('❌ Count error:', countError);
      return;
    }
    
    console.log(`📊 Total games in database: ${count}`);
    
    // Get sample of recent games with BGG IDs
    const { data: recentGames, error: recentError } = await supabase
      .from('games')
      .select('id, bgg_id, title')
      .not('bgg_id', 'is', null)
      .order('id', { ascending: false })
      .limit(10);
      
    if (recentError) {
      console.error('❌ Recent games error:', recentError);
      return;
    }
    
    console.log('\n🎯 Last 10 games with BGG IDs:');
    recentGames.forEach((game, i) => {
      console.log(`   ${(i+1).toString().padStart(2)} - ID: ${game.id.toString().padStart(4)} | BGG ID: ${(game.bgg_id || 'null').toString().padStart(6)} | ${game.title}`);
    });
    
    // Check for specific BGG IDs that were causing duplicate errors
    const problemBggIds = [39953, 157526, 164338, 134253, 202077];
    console.log('\n🔍 Checking for BGG IDs that caused duplicate key errors:');
    
    for (const bggId of problemBggIds) {
      const { data: existing, error } = await supabase
        .from('games')
        .select('id, bgg_id, title')
        .eq('bgg_id', bggId)
        .single();
        
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error(`   Error checking BGG ID ${bggId}:`, error);
      } else if (existing) {
        console.log(`   ✅ BGG ID ${bggId} EXISTS in database: "${existing.title}" (ID: ${existing.id})`);
      } else {
        console.log(`   ❌ BGG ID ${bggId} NOT FOUND in database`);
      }
    }
    
    // Count how many games have BGG IDs vs don't
    const { count: withBggId } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('bgg_id', 'is', null);
      
    const { count: withoutBggId } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .is('bgg_id', null);
    
    console.log('\n📊 BGG ID Distribution:');
    console.log(`   Games with BGG IDs: ${withBggId}`);
    console.log(`   Games without BGG IDs: ${withoutBggId}`);
    console.log(`   Total: ${(withBggId || 0) + (withoutBggId || 0)}`);
    
  } catch (error) {
    console.error('❌ Error debugging database:', error);
  }
}

// Handle script execution
if (require.main === module) {
  debugDatabaseState()
    .then(() => {
      console.log('\n✅ Database debug completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debug failed:', error);
      process.exit(1);
    });
}
