import { config } from 'dotenv';
import { amazonAPIService } from '../lib/amazon-api-service';

// Load environment variables
config({ path: '.env.local' });

async function testAmazonAPI() {
  console.log('🚀 Testing Amazon Product Advertising API');
  console.log('=========================================\n');

  try {
    // Check if API is available
    if (!amazonAPIService.isAvailable()) {
      console.log('❌ Amazon API not available. Please set environment variables:');
      console.log('   - AMAZON_ACCESS_KEY');
      console.log('   - AMAZON_SECRET_KEY'); 
      console.log('   - AMAZON_PARTNER_TAG');
      return;
    }

    console.log('✅ Amazon API service initialized');
    
    // Get rate limit info
    const rateLimits = amazonAPIService.getRateLimitInfo();
    console.log(`📊 Rate limits: ${rateLimits.requestsPerSecond}/sec, ${rateLimits.dailyLimit}/day\n`);

    // Test games to search for
    const testGames = [
      'Wingspan',
      'Azul',
      'Splendor',
      'Ticket to Ride'
    ];

    for (const gameTitle of testGames) {
      console.log(`🎲 Testing search for: ${gameTitle}`);
      console.log('---'.repeat(20));

      try {
        const result = await amazonAPIService.searchBoardGames(gameTitle, {
          maxResults: 3,
          sortBy: 'Relevance',
          minReviewsRating: 3
        });

        if (!result.success) {
          console.log(`❌ Search failed: ${result.error}`);
          continue;
        }

        console.log(`✅ Found ${result.items?.length || 0} items (${result.totalResults} total)`);
        
        if (result.items && result.items.length > 0) {
          result.items.forEach((item, index) => {
            console.log(`\n  ${index + 1}. ${item.title}`);
            console.log(`     ASIN: ${item.asin}`);
            console.log(`     Price: ${item.price ? `$${item.price} ${item.currency}` : 'Not available'}`);
            console.log(`     Prime: ${item.prime ? 'Yes' : 'No'}`);
            console.log(`     Rating: ${item.rating ? `${item.rating}/5 (${item.reviewCount} reviews)` : 'No rating'}`);
            console.log(`     URL: ${item.url}`);
            
            if (item.imageUrl) {
              console.log(`     Image: ${item.imageUrl}`);
            }
          });

          // Test database save with the first item
          const firstItem = result.items[0];
          if (firstItem.price) {
            console.log(`\n  💾 Testing database save...`);
            const testGameId = 'test-game-id-' + Date.now();
            const saved = await amazonAPIService.saveToDatabase(testGameId, firstItem);
            
            if (saved) {
              console.log(`  ✅ Successfully saved to database`);
              
              // Clean up test data
              const { createClient } = await import('@supabase/supabase-js');
              const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!
              );
              
              await supabase
                .from('game_prices')
                .delete()
                .eq('game_id', testGameId);
              console.log(`  🧹 Test data cleaned up`);
            } else {
              console.log(`  ❌ Failed to save to database`);
            }
          }
        }

        console.log(''); // Empty line between games
        
        // Rate limiting - wait 1 second between requests
        if (testGames.indexOf(gameTitle) < testGames.length - 1) {
          console.log('⏳ Waiting 1 second (rate limiting)...\n');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error testing ${gameTitle}:`, error);
      }
    }

    // Test GetItems operation with a known ASIN
    console.log('🔍 Testing GetItems operation with known ASINs');
    console.log('---'.repeat(20));
    
    // These are real board game ASINs from Amazon
    const testASINs = ['B07YQ641NQ', 'B077HJBQZX']; // Wingspan, Azul
    
    try {
      const itemsResult = await amazonAPIService.getItems(testASINs);
      
      if (itemsResult.success && itemsResult.items) {
        console.log(`✅ Retrieved ${itemsResult.items.length} items by ASIN`);
        
        itemsResult.items.forEach((item, index) => {
          console.log(`\n  ${index + 1}. ${item.title}`);
          console.log(`     ASIN: ${item.asin}`);
          console.log(`     Price: ${item.price ? `$${item.price} ${item.currency}` : 'Not available'}`);
          console.log(`     Prime: ${item.prime ? 'Yes' : 'No'}`);
        });
      } else {
        console.log(`❌ GetItems failed: ${itemsResult.error}`);
      }
    } catch (error) {
      console.error('❌ GetItems error:', error);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }

  console.log('\n✅ Amazon API test completed');
  console.log('\n🎉 Amazon Product Advertising API Integration Ready!');
  console.log('================================================');
  console.log('Benefits of using the official API:');
  console.log('  ✅ No bot detection issues');
  console.log('  ✅ Reliable, structured data');
  console.log('  ✅ Real-time pricing');
  console.log('  ✅ Affiliate link support');
  console.log('  ✅ Rich product metadata');
  console.log('  ✅ Proper rate limiting');
  console.log('  ✅ No HTML parsing needed');
}

testAmazonAPI();
