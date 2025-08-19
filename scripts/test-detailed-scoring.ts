import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDetailedScoring() {
  console.log('🧪 Testing Detailed Scoring for Problematic Games\n');

  const { amazonAPIService } = await import('../lib/amazon-api-service');

  if (!amazonAPIService.isAvailable()) {
    console.error('❌ Amazon API not available');
    return;
  }

  // Test with just a few problematic games to see the detailed scoring
  const testGames = [
    { id: 'test1', title: 'Magic Realm' },
    { id: 'test2', title: 'Can\'t Stop' },
    { id: 'test3', title: 'Wingspan' } // This should work well for comparison
  ];

  for (let i = 0; i < testGames.length; i++) {
    const game = testGames[i];
    console.log(`[${i + 1}/${testGames.length}] 🎲 ${game.title}`);
    console.log('=' .repeat(60));
    
    try {
      // This will trigger the detailed scoring analysis in findBestMatch
      const searchResult = await amazonAPIService.searchBoardGames(game.title, {
        maxResults: 5,
        sortBy: 'Relevance',
        minReviewsRating: 3
      });

      if (!searchResult.success) {
        console.log(`   ❌ Amazon search failed: ${searchResult.error}`);
        continue;
      }

      if (!searchResult.items || searchResult.items.length === 0) {
        console.log(`   ❌ No Amazon results found`);
        continue;
      }

      // Filter products (same logic as in update script)
      const validProducts = searchResult.items.filter(item => 
        item.price && 
        item.price > 10 && 
        item.price < 500 && 
        item.url
      );

      if (validProducts.length === 0) {
        console.log(`   ✅ CORRECTLY REJECTED all ${searchResult.items.length} products - no suitable matches`);
      } else {
        const bestMatch = validProducts[0];
        console.log(`   ⚠️  WOULD ACCEPT: $${bestMatch.price} - ${bestMatch.title}`);
        console.log(`   🔗 URL: ${bestMatch.url?.substring(0, 80)}...`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    if (i < testGames.length - 1) {
      console.log(`\n   ⏳ Waiting 2 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log();
    }
  }

  console.log('🏁 Detailed scoring test completed!');
  console.log('\n💡 Check the scoring details above to see if the algorithm');
  console.log('   is correctly identifying and rejecting bad matches.');
}

testDetailedScoring().catch(console.error);
