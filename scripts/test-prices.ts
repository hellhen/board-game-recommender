import { priceService } from '../lib/price-service';
import { supabase } from '../lib/supabase';

/**
 * Script to populate initial price data for a subset of popular games
 * Run this script to test the price scraping functionality
 */

async function getPopularGames(limit = 20): Promise<Array<{ id: string; title: string }>> {
  try {
    const { data, error } = await supabase
      .from('games')
      .select('id, title, complexity')
      .not('title', 'is', null)
      .order('complexity', { ascending: true }) // Start with simpler games that are more likely to be found
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error fetching popular games:', error);
    return [];
  }
}

async function testPriceScraping() {
  console.log('🚀 Starting price scraping test...');
  
  try {
    // Get a small set of games to test with
    const testGames = await getPopularGames(10);
    console.log(`📋 Testing with ${testGames.length} games:`);
    testGames.forEach((game, index) => {
      console.log(`  ${index + 1}. ${game.title} (${game.id})`);
    });

    if (testGames.length === 0) {
      console.log('❌ No games found to test with');
      return;
    }

    console.log('\n🔍 Starting individual game price updates...');
    
    // Test individual game updates
    for (let i = 0; i < Math.min(3, testGames.length); i++) {
      const game = testGames[i];
      console.log(`\n--- Testing ${game.title} ---`);
      
      try {
        const success = await priceService.updateGamePrices(game.id, game.title, true);
        if (success) {
          // Show the results
          const prices = await priceService.getGamePrices(game.id);
          console.log(`✅ Found ${prices.length} prices:`);
          prices.forEach(price => {
            console.log(`  ${price.store_name}: $${price.price} (${price.availability}) - confidence: ${price.scrape_confidence}`);
          });
        } else {
          console.log(`❌ Failed to get prices for ${game.title}`);
        }
      } catch (error) {
        console.error(`❌ Error updating ${game.title}:`, error);
      }
      
      // Wait between games to be respectful
      if (i < 2) {
        console.log('⏳ Waiting 3 seconds...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    // Test bulk update with remaining games
    if (testGames.length > 3) {
      console.log('\n📦 Testing bulk update with remaining games...');
      const remainingGames = testGames.slice(3, 6); // Test with 3 more games
      const successCount = await priceService.updateBulkGamePrices(remainingGames, 2);
      console.log(`✅ Bulk update complete: ${successCount}/${remainingGames.length} successful`);
    }

    // Show final statistics
    console.log('\n📊 Final statistics:');
    const stats = await priceService.getPriceStatistics();
    console.log(`  Total games with prices: ${stats.totalGamesWithPrices}`);
    console.log(`  Average price: $${stats.averagePrice.toFixed(2)}`);
    console.log(`  Prices by store:`);
    Object.entries(stats.pricesByStore).forEach(([store, data]) => {
      console.log(`    ${store}: ${data.count} games, avg $${data.averagePrice.toFixed(2)}`);
    });
    console.log(`  Last updated: ${stats.lastUpdated.toLocaleString()}`);

    console.log('\n🎉 Price scraping test complete!');
    
  } catch (error) {
    console.error('❌ Fatal error in price scraping test:', error);
  }
}

async function testPriceAPI() {
  console.log('\n🧪 Testing price enrichment for recommendations...');
  
  try {
    // Get some games that we hopefully have prices for
    const gamesWithPrices = await priceService.getGamesWithPrices(
      (await getPopularGames(5)).map(g => g.id)
    );

    console.log('Games with price data:');
    gamesWithPrices.forEach(game => {
      if (game.bestPrice) {
        console.log(`  ${game.title}: $${game.bestPrice.price} at ${game.bestPrice.store}`);
      } else {
        console.log(`  ${game.title}: No prices found`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing price API:', error);
  }
}

// Main execution
async function main() {
  console.log('🎯 Board Game Price Scraping Test');
  console.log('==================================\n');
  
  const args = process.argv.slice(2);
  const testType = args[0] || 'scraping';
  
  switch (testType) {
    case 'scraping':
      await testPriceScraping();
      break;
    case 'api':
      await testPriceAPI();
      break;
    case 'both':
      await testPriceScraping();
      await testPriceAPI();
      break;
    default:
      console.log('Usage: node test-prices.js [scraping|api|both]');
      console.log('  scraping: Test the price scraping functionality');
      console.log('  api: Test the price API functionality');
      console.log('  both: Run both tests');
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { testPriceScraping, testPriceAPI };
