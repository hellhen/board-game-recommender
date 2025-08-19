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

async function testPriceScraping() {
  console.log('🚀 Testing Price Scraping with Real Database');
  console.log('===========================================\n');

  try {
    // Get a few sample games to test with
    const sampleGames = [
      { id: 'd7565f7b-ea5d-4860-889a-da3328344408', title: 'Wingspan' },
      { id: '96395959-8edd-4eed-91e1-83207fb64787', title: 'Azul' }
    ];

    console.log('📋 Testing with games:');
    sampleGames.forEach(game => console.log(`  - ${game.title} (${game.id})`));
    console.log('');

    // Test individual game price update
    const testGame = sampleGames[0];
    console.log(`🎯 Testing single game price update: ${testGame.title}`);
    
    const updateResult = await priceService.updateGamePrices(testGame.id, testGame.title, true);
    
    if (updateResult) {
      console.log('✅ Price update completed successfully');
    } else {
      console.log('⚠️ Price update failed or had issues');
    }

    // Check the results
    console.log('\n🔍 Checking scraped prices...');
    const gameWithPrices = await priceService.getGamesWithPrices([testGame.id]);
    
    if (gameWithPrices.length > 0) {
      const game = gameWithPrices[0];
      console.log(`📊 Found ${game.prices.length} price(s) for ${game.title}:`);
      
      game.prices.forEach(price => {
        console.log(`  - ${price.store_name}: $${price.price.toFixed(2)} (${price.url})`);
      });

      if (game.bestPrice) {
        console.log(`💰 Best price: $${game.bestPrice.price.toFixed(2)} at ${game.bestPrice.store}`);
      }
    } else {
      console.log('❌ No price data found');
    }

    // Test price statistics
    console.log('\n📈 Getting price statistics...');
    const stats = await priceService.getPriceStatistics();
    console.log(`📊 Statistics:`);
    console.log(`  - Games with prices: ${stats.totalGamesWithPrices}`);
    console.log(`  - Average price: $${stats.averagePrice.toFixed(2)}`);
    console.log(`  - Stores:`);
    Object.entries(stats.pricesByStore).forEach(([store, data]) => {
      console.log(`    * ${store}: ${data.count} games, avg $${data.averagePrice.toFixed(2)}`);
    });

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }

  console.log('\n✅ Price scraping test completed');
}

testPriceScraping();
