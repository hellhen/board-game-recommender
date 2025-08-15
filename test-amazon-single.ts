#!/usr/bin/env tsx

/**
 * Test single Amazon API call after credential warm-up period
 */

// Load environment variables
import { config } from 'dotenv';
config({ path: '.env.local' });

import AmazonAPIServiceV3, { AmazonProduct } from './lib/amazon-api-service-v3';

async function testSingleAmazonAPICall() {
  console.log('🔍 Testing Amazon Product API (post warm-up)...\n');

  // Debug environment variables
  console.log('🔧 Environment check:');
  console.log(`   AMAZON_ACCESS_KEY: ${process.env.AMAZON_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   AMAZON_SECRET_KEY: ${process.env.AMAZON_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   AMAZON_PARTNER_TAG: ${process.env.AMAZON_PARTNER_TAG ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  try {
    const amazonService = new AmazonAPIServiceV3();
    
    console.log('📦 Testing with: Wingspan board game');
    console.log('⏱️  This is our first test after ~1 hour warm-up period\n');
    
    // Test with a well-known board game
    const result = await amazonService.searchBoardGames('Wingspan', {
      maxResults: 5,
      sortBy: 'Price:LowToHigh'
    });
    
    if (result.success && result.items && result.items.length > 0) {
      console.log('🎉 SUCCESS! Amazon API is now working!');
      console.log(`✅ Found ${result.items.length} products\n`);
      
      result.items.forEach((item: AmazonProduct, index: number) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   ASIN: ${item.asin}`);
        console.log(`   Price: ${item.currency} ${item.price || 'N/A'}`);
        console.log(`   URL: ${item.url}`);
        console.log(`   Prime: ${item.prime ? 'Yes' : 'No'}`);
        if (item.rating) {
          console.log(`   Rating: ${item.rating}/5 (${item.reviewCount} reviews)`);
        }
        console.log('');
      });
      
      console.log('🚀 Amazon API credentials are now warmed up and ready for production!');
      
    } else if (result.error) {
      console.log('❌ Amazon API still not working:');
      console.log(`   Error: ${result.error}`);
      console.log('   This could mean:');
      console.log('   - Credentials need more time to warm up');
      console.log('   - There\'s an authentication issue');
      console.log('   - API endpoint or parameters need adjustment');
      
    } else {
      console.log('⚠️  API call succeeded but no products found');
      console.log('   This might indicate the search query needs refinement');
    }
    
  } catch (error) {
    console.error('💥 Test failed with error:', error);
    
    if (error instanceof Error) {
      console.log('\n🔍 Error analysis:');
      if (error.message.includes('credentials')) {
        console.log('   → Likely still a credentials warming issue');
      } else if (error.message.includes('403')) {
        console.log('   → Forbidden - credentials might need more time');
      } else if (error.message.includes('throttle')) {
        console.log('   → Rate limiting - API is working but needs slower requests');
      } else {
        console.log(`   → Unexpected error: ${error.message}`);
      }
    }
  }
}

// Run the test
testSingleAmazonAPICall().catch(console.error);
