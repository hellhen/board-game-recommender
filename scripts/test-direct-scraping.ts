import dotenv from 'dotenv';
import { AmazonScraper, MiniatureMarketScraper } from '../lib/price-scraper';
import { createClient } from '@supabase/supabase-js';

// Load environment variables FIRST
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDirectScraping() {
  console.log('🚀 Testing Direct Price Scraping');
  console.log('================================\n');

  try {
    // Get a sample game to test with
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, title')
      .limit(1);

    if (gamesError) {
      console.error('❌ Error fetching games:', gamesError);
      return;
    }

    if (!games || games.length === 0) {
      console.error('❌ No games found in database');
      return;
    }

    const testGame = games[0];
    console.log(`🎯 Testing with game: ${testGame.title} (${testGame.id})`);

    // Test Amazon scraper
    console.log('\n📦 Testing Amazon scraper...');
    const amazonScraper = new AmazonScraper();
    
    try {
      const amazonResult = await amazonScraper.searchGame(testGame.title, testGame.id);
      console.log(`Amazon result:`, amazonResult);
      
      if (amazonResult.success) {
        console.log('💾 Saving Amazon price data...');
        await amazonScraper.savePriceData(testGame.id, amazonResult);
        console.log('✅ Amazon price saved successfully');
      }
    } catch (error) {
      console.error('❌ Amazon scraper error:', error);
    }

    // Test Miniature Market scraper  
    console.log('\n🏪 Testing Miniature Market scraper...');
    const mmScraper = new MiniatureMarketScraper();
    
    try {
      const mmResult = await mmScraper.searchGame(testGame.title, testGame.id);
      console.log(`Miniature Market result:`, mmResult);
      
      if (mmResult.success) {
        console.log('💾 Saving Miniature Market price data...');
        await mmScraper.savePriceData(testGame.id, mmResult);
        console.log('✅ Miniature Market price saved successfully');
      }
    } catch (error) {
      console.error('❌ Miniature Market scraper error:', error);
    }

    // Check saved prices
    console.log('\n🔍 Checking saved prices...');
    const { data: savedPrices, error: pricesError } = await supabase
      .from('game_prices')
      .select('*')
      .eq('game_id', testGame.id)
      .order('price', { ascending: true });

    if (pricesError) {
      console.error('❌ Error fetching saved prices:', pricesError);
    } else if (savedPrices && savedPrices.length > 0) {
      console.log(`📊 Found ${savedPrices.length} saved price(s):`);
      savedPrices.forEach((price: any) => {
        console.log(`  - ${price.store_name}: $${price.price.toFixed(2)} (${price.url})`);
      });
    } else {
      console.log('❌ No saved prices found');
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }

  console.log('\n✅ Direct scraping test completed');
}

testDirectScraping();
