#!/usr/bin/env tsx

/**
 * Test streamlined BGG URL generation functionality
 */

import { BGGPriceService } from '../lib/bgg-price-service';
import { SmartPriceService } from '../lib/smart-price-service';

async function testBGGPriceService() {
  console.log('🧪 Testing BGG Price Service (URL-only mode)...\n');

  const bggService = new BGGPriceService();
  
  // Test games with known BGG pages
  const testGames = [
    'Wingspan',
    'Azul', 
    'Patchwork',
    'Splendor',
    'Ticket to Ride'
  ];

  for (const gameTitle of testGames) {
    console.log(`📦 Testing: ${gameTitle}`);
    console.log('═'.repeat(50));
    
    try {
      // Test the main service method
      const result = await bggService.getGamePrices(gameTitle);
      
      if (result.success) {
        console.log(`✅ Found BGG info for: ${gameTitle}\n`);
        
        console.log(`🎯 Game: ${result.gameTitle || gameTitle}\n`);
        console.log(`🛒 Store Info (${result.prices?.length || 0} found):`);
        
        if (result.prices) {
          result.prices.forEach((price, index) => {
            console.log(`  ${index + 1}. ${price.storeName} - ${price.currency} ${price.price === 0 ? 'N/A' : price.price}`);
            console.log(`     URL: ${price.url}`);
          });
        }
      } else {
        console.log(`❌ Failed to find BGG info for: ${gameTitle}`);
        console.log(`   Error: ${result.error}`);
      }
      
    } catch (error) {
      console.log(`💥 Error testing ${gameTitle}:`, error);
    }
    
    console.log('\n');
  }
}

async function testSmartPriceServiceWithBGG() {
  console.log('\n🧠 Testing Smart Price Service with BGG Integration...\n');

  const smartService = new SmartPriceService();
  
  console.log('📦 Testing Smart Price Service for: Wingspan');
  
  try {
    const result = await smartService.getGamePrice('266192', 'Wingspan');
    
    console.log('\n🎯 Smart Price Result:');
    console.log(`  Title: ${result.title}`);
    console.log(`  Price: ${result.price ? `${result.currency} ${result.price}` : 'N/A'}`);
    console.log(`  Store: ${result.storeName}`);
    console.log(`  Source: ${result.source}`);
    console.log(`  URL: ${result.url}`);
    console.log(`  Last Updated: ${result.lastUpdated}`);
    
  } catch (error) {
    console.error('💥 Smart price service test failed:', error);
  }
}

async function runTests() {
  try {
    await testBGGPriceService();
    await testSmartPriceServiceWithBGG();
    console.log('✅ All tests completed!');
  } catch (error) {
    console.error('💥 Test suite failed:', error);
  }
}

// Run the tests
runTests().catch(console.error);
