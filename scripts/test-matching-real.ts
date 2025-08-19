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

async function testMatchingWithRealGames() {
  console.log('🧪 Testing Improved Matching with Real Database Games\n');

  // Get a few test games from the database
  const { data: games, error } = await supabase
    .from('games')
    .select('id, title, bgg_id')
    .in('title', ['Wingspan', 'Azul', 'Pandemic', 'Root', 'Scythe'])
    .limit(3);

  if (error || !games || games.length === 0) {
    console.error('❌ Could not fetch test games from database');
    return;
  }

  console.log(`🎯 Testing with ${games.length} games from database:\n`);

  const { amazonAPIService } = await import('../lib/amazon-api-service');

  if (!amazonAPIService.isAvailable()) {
    console.error('❌ Amazon API not available');
    return;
  }

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    console.log(`[${i + 1}/${games.length}] 🎲 ${game.title} (ID: ${game.id})`);
    
    try {
      // Use the actual updateGamePrice logic but without saving to database
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

      console.log(`   📦 Found ${searchResult.items.length} Amazon results`);

      // Filter products (same logic as in update script)
      const validProducts = searchResult.items.filter(item => 
        item.price && 
        item.price > 10 && 
        item.price < 500 && 
        item.url
      );

      if (validProducts.length === 0) {
        console.log(`   ⚠️ No valid products with prices found`);
      } else {
        console.log(`   ✅ ${validProducts.length} products with valid prices:`);
        validProducts.slice(0, 3).forEach((product, index) => {
          console.log(`      ${index + 1}. $${product.price} - ${product.title.substring(0, 70)}...`);
          if (product.url) {
            console.log(`         🔗 ${product.url.substring(0, 80)}...`);
          }
        });
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Rate limiting
    if (i < games.length - 1) {
      console.log(`   ⏳ Waiting 2 seconds...\n`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log();
    }
  }

  console.log('🏁 Matching test completed!');
  console.log('\n💡 Review the results above to see if the matching looks more accurate.');
  console.log('   The new algorithm should reject poor matches and prefer exact board game products.');
}

testMatchingWithRealGames().catch(console.error);
