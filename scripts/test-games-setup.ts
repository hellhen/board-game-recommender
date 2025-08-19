import { config } from 'dotenv';
import { supabase } from '../lib/supabase';

// Load environment variables
config({ path: '.env.local' });

async function testGamesFetch() {
  console.log('🧪 Testing Game Database Connection and Structure\n');

  if (!supabase) {
    console.error('❌ Supabase not available');
    return;
  }

  try {
    // Test connection and get sample games
    console.log('📚 Fetching first 10 games from database...');
    const { data: games, error } = await supabase
      .from('games')
      .select('id, title, bgg_id, image_url')
      .order('bgg_id', { ascending: true, nullsFirst: false })
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!games || games.length === 0) {
      console.log('⚠️ No games found in database');
      
      // Check if the table exists and has any data
      const { data: allGames, error: countError } = await supabase
        .from('games')
        .select('id, title')
        .limit(5);
      
      if (countError) {
        console.error('❌ Error checking games table:', countError);
      } else {
        console.log(`📊 Found ${allGames?.length || 0} total games in database`);
        if (allGames?.length) {
          console.log('📋 Sample games:');
          allGames.forEach((game, i) => {
            console.log(`   ${i + 1}. ${game.title} (ID: ${game.id})`);
          });
        }
      }
      return;
    }

    console.log(`✅ Found ${games.length} games. Sample:`)
    games.forEach((game, i) => {
      console.log(`   ${i + 1}. ${game.title} (BGG ID: ${game.bgg_id || 'N/A'})`);
    });

    // Test game_prices table structure
    console.log('\n🏷️ Testing game_prices table...');
    const { data: prices, error: pricesError } = await supabase
      .from('game_prices')
      .select('*')
      .limit(5);

    if (pricesError) {
      console.error('❌ Error accessing game_prices table:', pricesError);
      
      // The table might not exist, let's check
      console.log('💡 game_prices table might not exist. Let me check the schema...');
      
      // Try to get table info (this might fail, but will give us info)
      const { error: schemaError } = await supabase
        .from('game_prices')
        .select('game_id, store_name, price, currency, url, last_updated')
        .limit(1);
        
      if (schemaError) {
        console.log('📋 game_prices table needs to be created. Expected schema:');
        console.log(`
CREATE TABLE game_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  store_name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  url TEXT NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB,
  UNIQUE(game_id, store_name)
);`);
      }
    } else {
      console.log(`✅ game_prices table accessible with ${prices?.length || 0} existing records`);
      if (prices?.length) {
        console.log('📋 Sample price records:');
        prices.forEach((price, i) => {
          console.log(`   ${i + 1}. ${price.store_name}: $${price.price} for game ${price.game_id}`);
        });
      }
    }

    // Test Amazon credentials
    console.log('\n🔑 Testing Amazon API credentials...');
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const partnerTag = process.env.AMAZON_PARTNER_TAG;

    if (!accessKey || !secretKey || !partnerTag) {
      console.error('❌ Missing Amazon API credentials');
      console.log('Required environment variables:');
      console.log('   AMAZON_ACCESS_KEY');
      console.log('   AMAZON_SECRET_KEY');
      console.log('   AMAZON_PARTNER_TAG');
    } else {
      console.log(`✅ Amazon credentials present:
   Access Key: ${accessKey.substring(0, 8)}...
   Secret Key: ${secretKey.substring(0, 8)}...
   Partner Tag: ${partnerTag}`);
    }

    console.log('\n✅ Test complete! Ready to run the full price update script.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGamesFetch().catch(console.error);
