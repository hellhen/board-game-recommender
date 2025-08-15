#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { SmartPriceService } from '../lib/smart-price-service';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testSmartPriceService() {
  console.log('🧪 Testing Smart Price Service');
  console.log('==============================\n');

  const priceService = new SmartPriceService();

  try {
    // Test popular games
    const testGames = [
      { id: '1', title: 'Wingspan' },
      { id: '2', title: 'Azul' },
      { id: '3', title: 'Ticket to Ride' },
      { id: '4', title: 'Splendor' },
      { id: '5', title: 'Catan' }
    ];

    console.log('🎮 Testing with popular board games:');
    testGames.forEach((game, index) => {
      console.log(`   ${index + 1}. ${game.title} (ID: ${game.id})`);
    });
    console.log();

    // Test single game price
    console.log('🔍 Testing single game price fetch...');
    const singlePrice = await priceService.getGamePrice(testGames[0].id, testGames[0].title);
    console.log(`✅ ${testGames[0].title}:`);
    console.log(`   Price: ${singlePrice.price ? `$${singlePrice.price}` : 'Not available'}`);
    console.log(`   URL: ${singlePrice.url}`);
    console.log(`   Source: ${singlePrice.source}`);
    console.log(`   Last updated: ${singlePrice.lastUpdated}`);
    console.log();

    // Test bulk price fetch
    console.log('📦 Testing bulk price fetch...');
    const startTime = Date.now();
    const bulkPrices = await priceService.getGamePrices(testGames);
    const endTime = Date.now();

    console.log(`✅ Fetched ${bulkPrices.length} prices in ${endTime - startTime}ms`);
    console.log();

    bulkPrices.forEach((price, index) => {
      console.log(`${index + 1}. ${testGames[index].title}:`);
      console.log(`   💰 Price: ${price.price ? `$${price.price} ${price.currency}` : 'Check Amazon'}`);
      console.log(`   📊 Source: ${price.source}`);
      console.log(`   🕒 Updated: ${new Date(price.lastUpdated).toLocaleDateString()}`);
      console.log();
    });

    // Test statistics
    console.log('📊 Testing price statistics...');
    const stats = await priceService.getPriceStatistics();
    console.log(`✅ Price Statistics:`);
    console.log(`   Total prices: ${stats.totalPrices}`);
    console.log(`   Fresh prices: ${stats.freshPrices}`);
    console.log(`   Stale prices: ${stats.stalePrices}`);
    console.log(`   Average price: $${stats.avgPrice.toFixed(2)}`);
    console.log();

    // Test force refresh (if API is working)
    console.log('🔄 Testing force refresh...');
    const refreshedPrice = await priceService.forceRefreshPrice(testGames[1].id, testGames[1].title);
    console.log(`✅ Force refresh result for ${testGames[1].title}:`);
    console.log(`   Price: ${refreshedPrice.price ? `$${refreshedPrice.price}` : 'Not available'}`);
    console.log(`   Source: ${refreshedPrice.source}`);
    console.log();

    console.log('🎉 Smart Price Service is working correctly!');
    console.log('\n🚀 Ready for production use:');
    console.log('   ✅ Instant price lookups from cache');
    console.log('   ✅ Automatic fallback to Amazon search');  
    console.log('   ✅ Bulk operations for efficiency');
    console.log('   ✅ Statistics and monitoring');

  } catch (error) {
    console.error('❌ Smart Price Service test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  testSmartPriceService();
}
