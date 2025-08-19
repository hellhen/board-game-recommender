import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

async function testImprovedMatching() {
  console.log('🧪 Testing Improved Amazon Matching Algorithm\n');

  // Import Amazon API service with new matching logic
  const { amazonAPIService } = await import('../lib/amazon-api-service');

  if (!amazonAPIService.isAvailable()) {
    console.error('❌ Amazon API not available');
    return;
  }

  // Test with games that might have confusing matches
  const testGames = [
    'Wingspan',           // Should be clear
    'Azul',              // Common word, might match other things
    'Pandemic',          // Could match medical items
    'Root',              // Very generic word
    'Scythe',            // Could match farming tools
    'Gloomhaven',        // Unique name, should be clear
    'Brass: Birmingham', // Specific name with subtitle
    'Ticket to Ride'     // Common phrase
  ];

  for (let i = 0; i < testGames.length; i++) {
    const gameTitle = testGames[i];
    console.log(`[${i + 1}/${testGames.length}] 🎲 Testing: ${gameTitle}`);
    
    try {
      const searchResult = await amazonAPIService.searchBoardGames(gameTitle, {
        maxResults: 5,
        sortBy: 'Relevance'
      });

      if (searchResult.success && searchResult.items && searchResult.items.length > 0) {
        console.log(`   ✅ Found ${searchResult.items.length} results`);
        
        // Access the private findBestMatch method by calling updateGamePrice 
        // or manually implementing the logic here
        const validProducts = searchResult.items.filter(item => 
          item.price && 
          item.price > 10 && 
          item.price < 500 && 
          item.url
        );
        
        if (validProducts.length > 0) {
          console.log(`   📊 ${validProducts.length} products with valid prices`);
          validProducts.slice(0, 3).forEach((product, index) => {
            console.log(`   ${index + 1}. $${product.price} - ${product.title.substring(0, 60)}...`);
          });
        } else {
          console.log(`   ⚠️ No products with valid prices found`);
        }
      } else {
        console.log(`   ❌ No results or search failed: ${searchResult.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Rate limiting
    if (i < testGames.length - 1) {
      console.log(`   ⏳ Waiting 2 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log();
    }
  }

  console.log('🏁 Improved matching test completed!');
  console.log('\n💡 The new algorithm should:');
  console.log('   ✅ Require better word matching (70%+ of significant words)');
  console.log('   ✅ Prefer products with "board game" indicators');
  console.log('   ✅ Recognize known board game publishers');
  console.log('   ✅ Avoid accessories and expansions');
  console.log('   ✅ Filter by reasonable price ranges ($15-$200)');
  console.log('   ✅ Require minimum match score of 50');
}

testImprovedMatching().catch(console.error);
