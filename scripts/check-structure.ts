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

async function checkCurrentStructure() {
  console.log('🚀 Checking Current Database Structure');
  console.log('==================================\n');

  try {
    // Check if game_prices table exists and what columns it has
    console.log('🔍 Checking game_prices table...');
    const { data, error } = await supabase
      .from('game_prices')
      .select('*')
      .limit(1);

    if (error) {
      console.log('❌ Error querying game_prices:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ game_prices table exists');
      console.log('📋 Current columns in first record:');
      Object.keys(data[0]).forEach(key => {
        console.log(`  - ${key}: ${typeof data[0][key]} (value: ${data[0][key]})`);
      });
    } else {
      console.log('⚠️ game_prices table exists but is empty');
      
      // Try to insert a test record to see what columns are required
      console.log('🧪 Testing required columns by inserting a minimal record...');
      const testInsert = await supabase
        .from('game_prices')
        .insert([
          { 
            game_id: 999999,
            amazon_price: 0,
            amazon_url: 'test',
            miniature_market_price: 0,
            miniature_market_url: 'test',
            updated_at: new Date().toISOString()
          }
        ])
        .select();
      
      if (testInsert.error) {
        console.log('❌ Test insert failed:', testInsert.error);
        console.log('This tells us what columns are missing or have constraints');
      } else {
        console.log('✅ Test insert successful');
        console.log('📋 Inserted record structure:');
        if (testInsert.data && testInsert.data.length > 0) {
          Object.keys(testInsert.data[0]).forEach(key => {
            console.log(`  - ${key}: ${typeof testInsert.data[0][key]}`);
          });
        }
        
        // Clean up test record
        await supabase
          .from('game_prices')
          .delete()
          .eq('game_id', 999999);
        console.log('🧹 Cleaned up test record');
      }
    }

    // Check if we can select a few actual game records to see data
    console.log('\n🎲 Checking some actual game data...');
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('id, name')
      .limit(3);

    if (gameError) {
      console.log('❌ Error querying games:', gameError);
    } else {
      console.log('📋 Sample games:');
      gameData?.forEach(game => console.log(`  - ${game.id}: ${game.name}`));
      
      // Check if any of these games have price data
      if (gameData && gameData.length > 0) {
        const gameIds = gameData.map(g => g.id);
        const { data: priceData, error: priceError } = await supabase
          .from('game_prices')
          .select('*')
          .in('game_id', gameIds);

        if (priceError) {
          console.log('❌ Error querying prices for these games:', priceError);
        } else {
          console.log(`📊 Found ${priceData?.length || 0} price records for these games`);
          if (priceData && priceData.length > 0) {
            console.log('📋 Sample price record:');
            Object.entries(priceData[0]).forEach(([key, value]) => {
              console.log(`  - ${key}: ${value}`);
            });
          }
        }
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }

  console.log('\n✅ Structure check completed');
}

checkCurrentStructure();
