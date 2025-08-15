import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

console.log('🔧 Environment Variables Check');
console.log('==============================');
console.log(`AMAZON_ACCESS_KEY: ${process.env.AMAZON_ACCESS_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`AMAZON_SECRET_KEY: ${process.env.AMAZON_SECRET_KEY ? '✅ Set' : '❌ Not set'}`);
console.log(`AMAZON_PARTNER_TAG: ${process.env.AMAZON_PARTNER_TAG ? '✅ Set' : '❌ Not set'}`);

if (!process.env.AMAZON_ACCESS_KEY || !process.env.AMAZON_SECRET_KEY || !process.env.AMAZON_PARTNER_TAG) {
  console.log('\n❌ Amazon API credentials are not set.');
  console.log('\nTo use the Amazon Product Advertising API, you need to:');
  console.log('1. Sign up for Amazon Associates: https://affiliate-program.amazon.com/');
  console.log('2. Apply for Product Advertising API access');
  console.log('3. Get your Access Key, Secret Key, and Partner Tag');
  console.log('4. Add them to your .env.local file:');
  console.log('');
  console.log('AMAZON_ACCESS_KEY=your-access-key');
  console.log('AMAZON_SECRET_KEY=your-secret-key');
  console.log('AMAZON_PARTNER_TAG=your-associate-tag-20');
  console.log('');
  console.log('🔄 Once configured, you can replace web scraping with the reliable Amazon API!');
  process.exit(1);
}

console.log('\n✅ Amazon API credentials are configured!');
console.log('\n🚀 Ready to test Amazon Product Advertising API');
console.log('Run: npm run test:amazon-api');
