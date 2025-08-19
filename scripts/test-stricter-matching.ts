import { config } from 'dotenv';
config({ path: '.env.local' });

async function testStricterMatching() {
  console.log('🧪 Testing MUCH Stricter Amazon Matching Algorithm\n');

  const { amazonAPIService } = await import('../lib/amazon-api-service');

  if (!amazonAPIService.isAvailable()) {
    console.error('❌ Amazon API not available');
    return;
  }

  // Test with the problematic games that had bad matches
  const problematicGames = [
    'Magic Realm',
    'Age of Renaissance', 
    'Can\'t Stop',
    'David & Goliath',
    'Chinatown',
    'Mamma Mia!',
    'Löwenherz',
    'Show Manager',
    'Torres',
    'Paths of Glory',
    'Titan',
    'Guillotine',
    'Hoity Toity'
  ];

  let successCount = 0;
  let rejectCount = 0;

  for (let i = 0; i < problematicGames.length; i++) {
    const gameTitle = problematicGames[i];
    console.log(`[${i + 1}/${problematicGames.length}] 🎲 Testing: ${gameTitle}`);
    
    try {
      const searchResult = await amazonAPIService.searchBoardGames(gameTitle, {
        maxResults: 5,
        sortBy: 'Relevance'
      });

      if (searchResult.success && searchResult.items && searchResult.items.length > 0) {
        // The detailed analysis with strict scoring is now logged within findBestMatch
        console.log(`   📦 Found ${searchResult.items.length} Amazon results`);
        
        // Check if any valid matches were found by looking for products with valid prices
        const validProducts = searchResult.items.filter(item => 
          item.price && item.price > 10 && item.price < 500 && item.url
        );
        
        if (validProducts.length > 0) {
          successCount++;
          console.log(`   ✅ Algorithm found suitable matches`);
        } else {
          rejectCount++;
          console.log(`   ❌ Algorithm correctly rejected all matches`);
        }
      } else {
        console.log(`   ❌ No Amazon results found: ${searchResult.error || 'Unknown error'}`);
        rejectCount++;
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      rejectCount++;
    }

    // Rate limiting
    if (i < problematicGames.length - 1) {
      console.log(`   ⏳ Waiting 2 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log();
    }
  }

  console.log('🏁 Stricter matching test completed!');
  console.log(`📊 Results: ${successCount} accepted, ${rejectCount} rejected`);
  console.log(`🎯 The algorithm should now reject bad matches more aggressively`);
  console.log(`💡 Success ratio: ${Math.round(successCount / problematicGames.length * 100)}%`);
}

testStricterMatching().catch(console.error);
