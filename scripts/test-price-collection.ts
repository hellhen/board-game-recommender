import { config } from 'dotenv';

// Load environment variables first
config({ path: '.env.local' });

async function testPriceCollection() {
  console.log('🎯 Testing Price Collection for Top Games\n');

  // Test games (some popular board games we should have good results for)
  const testGames = [
    { id: 1, name: 'Wingspan', year: 2019 },
    { id: 2, name: 'Gloomhaven', year: 2017 },
    { id: 3, name: 'Azul', year: 2017 },
    { id: 4, name: 'Ticket to Ride', year: 2004 },
    { id: 5, name: 'Splendor', year: 2014 },
    { id: 6, name: 'Catan', year: 1995 },
    { id: 7, name: 'King of Tokyo', year: 2011 },
    { id: 8, name: 'Pandemic', year: 2008 },
    { id: 9, name: 'Codenames', year: 2015 },
    { id: 10, name: 'Brass Birmingham', year: 2018 }
  ];

  console.log(`🎲 Testing price collection for ${testGames.length} popular games...\n`);

  const results: Array<{
    game: typeof testGames[0];
    success: boolean;
    price?: number;
    url?: string;
    asin?: string;
    error?: string;
  }> = [];

  for (let i = 0; i < testGames.length; i++) {
    const game = testGames[i];
    console.log(`[${i + 1}/${testGames.length}] 🔍 Searching for: ${game.name} (${game.year})`);

    try {
      // Import the Amazon API service
      const { amazonAPIService } = await import('../lib/amazon-api-service');
      
      const searchResult = await amazonAPIService.searchBoardGames(game.name, {
        maxResults: 3,
        sortBy: 'Relevance'
      });
      
      const amazonResults = searchResult.success ? searchResult.items : [];
      
      if (amazonResults && amazonResults.length > 0) {
        const bestMatch = amazonResults[0]; // Take the first result for now
        results.push({
          game,
          success: true,
          price: bestMatch.price,
          url: bestMatch.url,
          asin: bestMatch.asin
        });
        
        console.log(`   ✅ Found: $${bestMatch.price} - ${bestMatch.title?.substring(0, 60)}...`);
        console.log(`   🔗 URL: ${bestMatch.url}`);
      } else {
        results.push({
          game,
          success: false,
          error: 'No results found'
        });
        console.log(`   ❌ No results found`);
      }
    } catch (error) {
      results.push({
        game,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Rate limiting - wait 3 seconds between requests
    if (i < testGames.length - 1) {
      console.log(`   ⏳ Waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log();
  }

  // Summary
  console.log('=' .repeat(60));
  console.log('📊 PRICE COLLECTION SUMMARY');
  console.log('=' .repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successfully found prices: ${successful.length}/${testGames.length}`);
  console.log(`❌ Failed to find prices: ${failed.length}/${testGames.length}`);
  console.log();

  if (successful.length > 0) {
    console.log('🎯 SUCCESSFUL RESULTS:');
    successful.forEach(result => {
      console.log(`   ${result.game.name} (${result.game.year}): $${result.price}`);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log('⚠️  FAILED RESULTS:');
    failed.forEach(result => {
      console.log(`   ${result.game.name} (${result.game.year}): ${result.error}`);
    });
    console.log();
  }

  // Price statistics
  if (successful.length > 0) {
    const prices = successful.map(r => r.price!);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    console.log('💰 PRICE STATISTICS:');
    console.log(`   Average Price: $${avgPrice.toFixed(2)}`);
    console.log(`   Price Range: $${minPrice} - $${maxPrice}`);
    console.log();
  }

  console.log('🏁 Test completed!');
  
  if (successful.length > 0) {
    console.log('✅ Amazon API is working well for price collection');
    console.log('📋 Next step: Set up database connection to store these prices');
  } else {
    console.log('❌ No successful price lookups - may need to debug API');
  }
}

testPriceCollection().catch(console.error);
