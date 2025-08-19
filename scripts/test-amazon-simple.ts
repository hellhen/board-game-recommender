#!/usr/bin/env tsx

import { AmazonAPIService } from '../lib/amazon-api-service';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testAmazonAPI() {
  console.log('🧪 Testing Amazon Product Advertising API');
  console.log('==========================================\n');
  
  try {
    // Initialize the service
    const amazonAPI = new AmazonAPIService();
    
    console.log('✅ Amazon API service initialized successfully');
    
    // Test with a popular board game
    const testGame = 'Wingspan';
    console.log(`🔍 Searching for: "${testGame}"`);
    
    const searchResult = await amazonAPI.searchBoardGames(testGame, { maxResults: 3 });
    
    if (!searchResult.success || !searchResult.items || searchResult.items.length === 0) {
      console.log('⚠️ No results found. This could indicate:');
      console.log('  - API credentials are incorrect');
      console.log('  - Game not found in Amazon catalog');
      console.log('  - API rate limit exceeded');
      if (searchResult.error) {
        console.log(`  - Error: ${searchResult.error}`);
      }
      return;
    }
    
    const results = searchResult.items;
    console.log(`✅ Found ${results.length} results:`);
    console.log();
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.title}`);
      console.log(`   💰 Price: ${result.price ? `$${result.price}` : 'Not available'}`);
      console.log(`   🔗 URL: ${result.url}`);
      console.log(`   🆔 ASIN: ${result.asin}`);
      console.log();
    });
    
    // Test database integration
    console.log('💾 Testing database save...');
    
    const firstResult = results[0];
    if (firstResult.price) {
      const success = await amazonAPI.updateGamePrice('1', testGame); // Using game ID '1' as test
      
      if (success) {
        console.log('✅ Successfully saved price to database');
      } else {
        console.log('⚠️ Failed to save to database (but API is working)');
      }
    }
    
    console.log('\n🎉 Amazon API is working correctly!');
    console.log('\nNext steps:');
    console.log('  npm run test:complete-pipeline  # Test full price collection');
    console.log('  npm run prices:api             # Start using API for price collection');
    
  } catch (error) {
    console.error('❌ Amazon API test failed:');
    
    if (error instanceof Error) {
      if (error.message.includes('InvalidParameterValue')) {
        console.error('  → Invalid API credentials. Please check your Access Key, Secret Key, and Partner Tag.');
      } else if (error.message.includes('RequestThrottled')) {
        console.error('  → API rate limit exceeded. Wait a moment and try again.');
      } else if (error.message.includes('InvalidPartnerTag')) {
        console.error('  → Invalid Partner Tag. Make sure it\'s your Amazon Associates tracking ID.');
      } else {
        console.error(`  → ${error.message}`);
      }
    } else {
      console.error('  → Unknown error occurred');
    }
    
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Verify credentials: npm run setup:amazon');
    console.log('  2. Check credentials: npx tsx scripts/check-amazon-credentials.ts');
    console.log('  3. Ensure Amazon Associates account is approved');
    console.log('  4. Verify PA API access has been granted');
  }
}

if (require.main === module) {
  testAmazonAPI();
}
