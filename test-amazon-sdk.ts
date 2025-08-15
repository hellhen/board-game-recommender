#!/usr/bin/env tsx

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Import the Amazon SDK directly
const paapi = require('paapi5-nodejs-sdk');

async function testAmazonSDK() {
  console.log('🧪 Testing Amazon PA API with Official SDK');
  console.log('==========================================\n');
  
  console.log('🔧 Environment check:');
  console.log(`   AMAZON_ACCESS_KEY: ${process.env.AMAZON_ACCESS_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   AMAZON_SECRET_KEY: ${process.env.AMAZON_SECRET_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   AMAZON_PARTNER_TAG: ${process.env.AMAZON_PARTNER_TAG ? '✅ Set' : '❌ Missing'}`);
  console.log('');
  
  try {
    // Initialize the client
    const client = paapi.ApiClient.instance;
    client.accessKey = process.env.AMAZON_ACCESS_KEY;
    client.secretKey = process.env.AMAZON_SECRET_KEY;
    client.host = 'webservices.amazon.com';
    client.region = 'us-east-1';
    
    console.log('✅ Amazon API client initialized');
    
    // Create search request
    const searchRequest = new paapi.SearchItemsRequest();
    
    // Set required parameters
    searchRequest['PartnerTag'] = process.env.AMAZON_PARTNER_TAG;
    searchRequest['PartnerType'] = 'Associates';
    searchRequest['Marketplace'] = 'www.amazon.com';
    searchRequest['Keywords'] = 'Wingspan board game';
    searchRequest['SearchIndex'] = 'ToysAndGames';
    searchRequest['ItemCount'] = 3;
    
    // Minimal resources to avoid errors
    searchRequest['Resources'] = [
      'ItemInfo.Title',
      'Offers.Summaries.LowestPrice'
    ];
    
    console.log('🔍 Making Amazon API search request...');
    console.log(`   Keywords: Wingspan board game`);
    console.log(`   Partner Tag: ${searchRequest['PartnerTag']}`);
    console.log('');
    
    // Execute search
    const api = new paapi.DefaultApi();
    
    return new Promise((resolve) => {
      api.searchItems(searchRequest, (error: any, data: any) => {
        if (error) {
          console.log('❌ Amazon API Error:');
          console.log('   Status:', error.status);
          console.log('   Message:', error.response?.text || error.message);
          
          if (error.status === 429) {
            console.log('   → Rate limiting - too many requests');
          } else if (error.status === 403) {
            console.log('   → Access denied - check credentials or approval status');
          } else if (error.status === 404) {
            console.log('   → Endpoint not found - possible API version issue');
          }
        } else if (data && data.SearchResult && data.SearchResult.Items) {
          console.log('🎉 SUCCESS! Amazon API is working!');
          console.log(`✅ Found ${data.SearchResult.Items.length} products:\n`);
          
          data.SearchResult.Items.forEach((item: any, index: number) => {
            const title = item.ItemInfo?.Title?.DisplayValue || 'Unknown Title';
            const price = item.Offers?.Summaries?.[0]?.LowestPrice?.DisplayAmount || 'N/A';
            const asin = item.ASIN;
            
            console.log(`${index + 1}. ${title}`);
            console.log(`   ASIN: ${asin}`);
            console.log(`   Price: ${price}`);
            console.log(`   URL: https://www.amazon.com/dp/${asin}?tag=${searchRequest['PartnerTag']}`);
            console.log('');
          });
          
          console.log('🚀 Amazon API credentials are warmed up and working!');
          
        } else {
          console.log('⚠️  API call succeeded but no results found');
          console.log('   Response:', JSON.stringify(data, null, 2));
        }
        
        resolve(null);
      });
    });
    
  } catch (error: any) {
    console.error('💥 Test failed with error:', error);
    console.log('   This might indicate a setup issue with the SDK');
  }
}

// Run the test
testAmazonSDK().catch(console.error);
