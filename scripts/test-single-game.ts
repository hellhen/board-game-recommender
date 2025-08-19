import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

// Create Supabase client with SERVICE ROLE for elevated permissions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables (need service role key)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testSingleGame(gameTitle: string) {
  console.log(`\n🎲 Testing intelligent matching for: "${gameTitle}"`);
  
  try {
    const { amazonAPIService } = await import('../lib/amazon-api-service');
    
    // Search for the game
    console.log(`   📡 Searching Amazon for "${gameTitle}"...`);
    const searchResult = await amazonAPIService.searchBoardGames(gameTitle, {
      maxResults: 10
    });

    if (!searchResult.success || !searchResult.items || searchResult.items.length === 0) {
      console.log(`   ❌ No products found for "${gameTitle}"`);
      return;
    }

    console.log(`   📊 Found ${searchResult.items.length} products from search`);

    // Filter for valid products
    const validProducts = searchResult.items.filter(item => 
      item.price && 
      item.price > 10 && 
      item.price < 500 && 
      item.url
    );

    console.log(`   📊 ${validProducts.length} products passed basic filters`);

    if (validProducts.length === 0) {
      console.log(`   ❌ No valid products after filtering`);
      return;
    }

    // Show what simple matching would pick
    console.log(`\n   🔍 SIMPLE MATCHING (OLD WAY):`);
    console.log(`   Would pick: "${validProducts[0].title}" - $${validProducts[0].price}`);

    // Show what intelligent matching picks
    console.log(`\n   🧠 INTELLIGENT MATCHING (NEW WAY):`);
    const bestMatch = (amazonAPIService as any).findBestMatch(gameTitle, validProducts);
    
    if (!bestMatch) {
      console.log(`   ✋ Intelligent matching REJECTED all products - no suitable match found`);
    } else {
      console.log(`   ✅ Selected: "${bestMatch.title}" - $${bestMatch.price}`);
    }

    // Show the difference
    if (bestMatch && validProducts[0].title !== bestMatch.title) {
      console.log(`\n   💡 IMPROVEMENT: Intelligent matching chose a different (better) product!`);
    } else if (!bestMatch) {
      console.log(`\n   🛡️ PROTECTION: Intelligent matching prevented a bad match!`);
    } else {
      console.log(`\n   ✅ CONFIRMATION: Both methods agree on this match`);
    }

  } catch (error) {
    console.error(`❌ Error testing "${gameTitle}":`, error);
  }
}

async function main() {
  console.log('🧪 Testing intelligent matching with problematic games...\n');
  
  // Test the games that were causing bad matches
  await testSingleGame('Magic Realm');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
  
  await testSingleGame('Can\'t Stop');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
  
  await testSingleGame('Age of Renaissance');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
  
  // Test a game that should match well
  await testSingleGame('Wingspan');
  
  console.log('\n✅ Testing complete!');
}

if (require.main === module) {
  main().catch(console.error);
}
