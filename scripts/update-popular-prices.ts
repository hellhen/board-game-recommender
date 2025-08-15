#!/usr/bin/env tsx

import dotenv from 'dotenv';
import { SmartPriceService } from '../lib/smart-price-service';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function updatePopularGamesPrices() {
  console.log('🚀 Starting Popular Games Price Update');
  console.log('=====================================');
  console.log(`📅 ${new Date().toISOString()}\n`);

  const priceService = new SmartPriceService();

  try {
    // Get current statistics
    console.log('📊 Current Price Statistics:');
    const stats = await priceService.getPriceStatistics();
    console.log(`   Total prices in database: ${stats.totalPrices}`);
    console.log(`   Fresh prices (< 3 days): ${stats.freshPrices}`);
    console.log(`   Stale prices (> 3 days): ${stats.stalePrices}`);
    console.log(`   Average price: $${stats.avgPrice.toFixed(2)}\n`);

    // Update top 25 popular games (conservative for API limits)
    const updateCount = process.argv[2] ? parseInt(process.argv[2]) : 25;
    console.log(`🔄 Updating top ${updateCount} popular games...\n`);

    const result = await priceService.updatePopularGamesPrices(updateCount);

    // Report results
    console.log('\n🎉 Update Complete!');
    console.log('==================');
    console.log(`✅ Successfully updated: ${result.updated}/${result.total} games`);
    console.log(`❌ Failed updates: ${result.failed}`);
    console.log(`📈 Success rate: ${((result.updated / result.total) * 100).toFixed(1)}%`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      result.errors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
      
      if (result.errors.length > 5) {
        console.log(`   ... and ${result.errors.length - 5} more errors`);
      }
    }

    // Get updated statistics
    console.log('\n📊 Updated Statistics:');
    const newStats = await priceService.getPriceStatistics();
    console.log(`   Fresh prices: ${newStats.freshPrices} (+${newStats.freshPrices - stats.freshPrices})`);
    console.log(`   Average price: $${newStats.avgPrice.toFixed(2)}`);

    console.log('\n✨ Price update job completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Price update job failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  updatePopularGamesPrices();
}
