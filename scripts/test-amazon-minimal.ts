#!/usr/bin/env tsx

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Import the Amazon SDK directly
const paapi = require('paapi5-nodejs-sdk');

async function testMinimalAmazonAPI() {
  console.log('🧪 Testing Amazon API with Minimal Request');
  console.log('==========================================\n');
  
  try {
    // Initialize the client
    const client = paapi.ApiClient.instance;
    client.accessKey = process.env.AMAZON_ACCESS_KEY;
    client.secretKey = process.env.AMAZON_SECRET_KEY;
    client.host = 'webservices.amazon.com';
    client.region = 'us-east-1';
    
    console.log('✅ Amazon API client initialized');
    
    // Create minimal search request
    const searchRequest = new paapi.SearchItemsRequest();
    
    // Set required parameters using exact property names
    searchRequest['PartnerTag'] = process.env.AMAZON_PARTNER_TAG;
    searchRequest['PartnerType'] = 'Associates';
    searchRequest['Marketplace'] = 'www.amazon.com';
    searchRequest['Keywords'] = 'Azul board game';
    searchRequest['SearchIndex'] = 'ToysAndGames';
    searchRequest['ItemCount'] = 3;
    
    // Minimal resources
    searchRequest['Resources'] = [
      'ItemInfo.Title',
      'Offers.Summaries.LowestPrice'
    ];
    
    console.log('🔍 Making Amazon API search request...');
    console.log(`   Keywords: ${searchRequest['Keywords']}`);
    console.log(`   Partner Tag: ${searchRequest['PartnerTag']}`);
    
    // Execute search
    const api = new paapi.DefaultApi();
    
    return new Promise((resolve) => {
      api.searchItems(searchRequest, (error: any, data: any) => {
        if (error) {
          console.error('❌ API Error:', error.message);
          if (error.response && error.response.text) {
            try {
              const errorBody = JSON.parse(error.response.text);
              console.log('📋 Error Details:', errorBody);
            } catch (e) {
              console.log('📋 Raw Error:', error.response.text);
            }
          }
          resolve(false);
          return;
        }
        
        console.log('✅ API call successful!');
        console.log('📦 Response received:', JSON.stringify(data, null, 2));
        resolve(true);
      });
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return false;
  }
}

if (require.main === module) {
  testMinimalAmazonAPI().then((success) => {
    if (success) {
      console.log('\n🎉 Amazon API is working correctly!');
    } else {
      console.log('\n❌ Amazon API test failed.');
    }
  });
}
