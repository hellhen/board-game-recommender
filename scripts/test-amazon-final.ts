#!/usr/bin/env tsx

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const paapi = require('paapi5-nodejs-sdk');

// Add proper delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function testAmazonWithProperRateLimit() {
  console.log('🧪 Testing Amazon API with Proper Rate Limiting');
  console.log('===============================================\n');
  
  try {
    // Initialize client
    const client = paapi.ApiClient.instance;
    client.accessKey = process.env.AMAZON_ACCESS_KEY;
    client.secretKey = process.env.AMAZON_SECRET_KEY;
    client.host = 'webservices.amazon.com';
    client.region = 'us-east-1';
    
    console.log('✅ Amazon API client initialized');
    console.log('⏱️  Implementing 2-second delay as per Amazon guidelines...\n');
    
    // Wait 2 seconds before making the request
    await delay(2000);
    
    // Create a very minimal request
    const searchRequest = new paapi.SearchItemsRequest();
    
    // Required parameters
    searchRequest.PartnerTag = process.env.AMAZON_PARTNER_TAG;
    searchRequest.PartnerType = 'Associates';
    searchRequest.Marketplace = 'www.amazon.com';
    searchRequest.Keywords = 'Monopoly'; // Very common game
    searchRequest.SearchIndex = 'All'; // Try broader category
    searchRequest.ItemCount = 1; // Minimal result count
    
    // Only essential resource
    searchRequest.Resources = ['ItemInfo.Title'];
    
    console.log('🔍 Making minimal API request...');
    console.log(`   Keywords: ${searchRequest.Keywords}`);
    console.log(`   ItemCount: ${searchRequest.ItemCount}`);
    console.log(`   Partner Tag: ${searchRequest.PartnerTag}`);
    
    const api = new paapi.DefaultApi();
    
    return new Promise((resolve) => {
      const requestTime = Date.now();
      
      api.searchItems(searchRequest, (error: any, data: any) => {
        const responseTime = Date.now() - requestTime;
        console.log(`⏱️  Request completed in ${responseTime}ms`);
        
        if (error) {
          console.error('❌ API Error Status:', error.status);
          console.error('❌ API Error Message:', error.message);
          
          if (error.response && error.response.text) {
            try {
              const errorBody = JSON.parse(error.response.text);
              console.log('📋 Detailed Error:');
              if (errorBody.Errors) {
                errorBody.Errors.forEach((err: any, index: number) => {
                  console.log(`   ${index + 1}. ${err.Code}: ${err.Message}`);
                });
              }
              
              // Check if it's specifically about rate limiting or something else
              if (error.status === 429) {
                console.log('\n💡 Analysis: This is definitely a rate limiting issue.');
                console.log('   Possible causes:');
                console.log('   - Multiple test requests have exceeded the 1 TPS limit');
                console.log('   - Amazon\'s throttling is more aggressive than documented');
                console.log('   - There might be other applications using the same credentials');
              }
              
            } catch (e) {
              console.log('📋 Raw Error Response:', error.response.text);
            }
          }
          
          resolve(false);
          return;
        }
        
        console.log('🎉 SUCCESS! API call worked!');
        
        if (data && data.SearchResult && data.SearchResult.Items) {
          console.log(`✅ Found ${data.SearchResult.Items.length} items:`);
          data.SearchResult.Items.forEach((item: any, index: number) => {
            console.log(`   ${index + 1}. ${item.ItemInfo?.Title?.DisplayValue || 'No title'}`);
            if (item.ASIN) {
              console.log(`      ASIN: ${item.ASIN}`);
            }
          });
        } else {
          console.log('📦 API returned but no items found in response');
          console.log('📋 Raw response:', JSON.stringify(data, null, 2));
        }
        
        resolve(true);
      });
    });
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    return false;
  }
}

if (require.main === module) {
  testAmazonWithProperRateLimit().then((success) => {
    if (success) {
      console.log('\n🎉 Amazon API integration is working perfectly!');
      console.log('🚀 Your purchase links system is ready for production!');
    } else {
      console.log('\n❌ Still encountering API issues.');
      console.log('💡 Recommendation: Wait 5-10 minutes before trying again.');
      console.log('   Amazon may have aggressive rate limiting for new accounts.');
    }
  });
}
