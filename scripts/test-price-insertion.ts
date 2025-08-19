import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testPriceInsertion() {
  console.log('🚀 Testing Price Data Insertion');
  console.log('===============================\n');

  try {
    // First, get a few game records
    console.log('🎲 Getting sample games...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, title')
      .limit(3);

    if (gamesError) {
      console.log('❌ Error fetching games:', gamesError);
      return;
    }

    console.log(`✅ Found ${games?.length} sample games:`);
    games?.forEach(game => console.log(`  - ${game.title} (${game.id})`));

    if (!games || games.length === 0) {
      console.log('❌ No games found to test with');
      return;
    }

    // Test inserting price data for the first game
    const testGame = games[0];
    console.log(`\n💰 Testing price insertion for: ${testGame.title}`);

    // Insert Amazon price data
    const amazonPriceData = {
      game_id: testGame.id,
      store_name: 'Amazon',
      price: 29.99,
      currency: 'USD',
      url: 'https://amazon.com/test-game',
      last_updated: new Date().toISOString()
    };

    console.log('📦 Inserting Amazon price...');
    const { data: amazonInsert, error: amazonError } = await supabase
      .from('game_prices')
      .insert([amazonPriceData])
      .select();

    if (amazonError) {
      console.log('❌ Amazon insert error:', amazonError);
    } else {
      console.log('✅ Amazon price inserted successfully');
      console.log('📄 Inserted record:', amazonInsert[0]);
    }

    // Insert Miniature Market price data
    const mmPriceData = {
      game_id: testGame.id,
      store_name: 'Miniature Market',
      price: 27.99,
      currency: 'USD',
      url: 'https://miniaturemarket.com/test-game',
      last_updated: new Date().toISOString()
    };

    console.log('🏪 Inserting Miniature Market price...');
    const { data: mmInsert, error: mmError } = await supabase
      .from('game_prices')
      .insert([mmPriceData])
      .select();

    if (mmError) {
      console.log('❌ Miniature Market insert error:', mmError);
    } else {
      console.log('✅ Miniature Market price inserted successfully');
      console.log('📄 Inserted record:', mmInsert[0]);
    }

    // Query the inserted prices
    console.log('🔍 Querying inserted prices...');
    const { data: prices, error: pricesError } = await supabase
      .from('game_prices')
      .select('*')
      .eq('game_id', testGame.id);

    if (pricesError) {
      console.log('❌ Error querying prices:', pricesError);
    } else {
      console.log(`✅ Found ${prices?.length} price records for ${testGame.title}:`);
      prices?.forEach(price => {
        console.log(`  - ${price.store_name}: $${price.price} (${price.url})`);
      });
    }

    // Test updating a price
    if (amazonInsert && amazonInsert[0]) {
      console.log('\n💰 Testing price update...');
      const { data: updateResult, error: updateError } = await supabase
        .from('game_prices')
        .update({ price: 24.99, last_updated: new Date().toISOString() })
        .eq('id', amazonInsert[0].id)
        .select();

      if (updateError) {
        console.log('❌ Update error:', updateError);
      } else {
        console.log('✅ Price updated successfully');
        console.log('📄 Updated record:', updateResult[0]);
      }
    }

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    const { error: deleteError } = await supabase
      .from('game_prices')
      .delete()
      .eq('game_id', testGame.id);

    if (deleteError) {
      console.log('❌ Delete error:', deleteError);
    } else {
      console.log('✅ Test data cleaned up');
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }

  console.log('\n✅ Price insertion test completed');
}

testPriceInsertion();
