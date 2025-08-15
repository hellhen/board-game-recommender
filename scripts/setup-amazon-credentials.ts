#!/usr/bin/env tsx

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ENV_FILE = resolve(process.cwd(), '.env.local');

interface AmazonCredentials {
  accessKey: string;
  secretKey: string;
  partnerTag: string;
}

function getCurrentEnvContent(): string {
  try {
    return readFileSync(ENV_FILE, 'utf-8');
  } catch (error) {
    return '';
  }
}

function updateEnvFile(credentials: AmazonCredentials): void {
  let envContent = getCurrentEnvContent();
  
  // Remove existing Amazon credentials if they exist
  envContent = envContent.replace(/^AMAZON_ACCESS_KEY=.*$/gm, '');
  envContent = envContent.replace(/^AMAZON_SECRET_KEY=.*$/gm, '');
  envContent = envContent.replace(/^AMAZON_PARTNER_TAG=.*$/gm, '');
  
  // Clean up extra newlines
  envContent = envContent.replace(/\n\n+/g, '\n\n').trim();
  
  // Add Amazon credentials section
  const amazonSection = `

# Amazon Product Advertising API
AMAZON_ACCESS_KEY=${credentials.accessKey}
AMAZON_SECRET_KEY=${credentials.secretKey}
AMAZON_PARTNER_TAG=${credentials.partnerTag}`;
  
  envContent += amazonSection;
  
  writeFileSync(ENV_FILE, envContent + '\n');
}

function promptForCredentials(): AmazonCredentials {
  console.log('🔑 Amazon API Credentials Setup');
  console.log('==================================');
  console.log();
  console.log('You\'ll need these from your Amazon Associates account:');
  console.log('1. Access Key (from PA API registration)');
  console.log('2. Secret Key (from PA API registration)');
  console.log('3. Partner Tag (your Amazon Associates tracking ID)');
  console.log();
  console.log('📋 Please edit this script with your credentials:');
  console.log();
  
  // For security, we'll have the user edit this script directly rather than typing in terminal
  const credentials: AmazonCredentials = {
    accessKey: 'YOUR_ACCESS_KEY_HERE',
    secretKey: 'YOUR_SECRET_KEY_HERE', 
    partnerTag: 'YOUR_PARTNER_TAG_HERE' // Usually ends with -20
  };
  
  // Check if credentials are still placeholder values
  if (credentials.accessKey === 'YOUR_ACCESS_KEY_HERE' || 
      credentials.secretKey === 'YOUR_SECRET_KEY_HERE' ||
      credentials.partnerTag === 'YOUR_PARTNER_TAG_HERE') {
    console.log('❌ Please edit this script file and replace the placeholder values:');
    console.log();
    console.log('File: scripts/setup-amazon-credentials.ts');
    console.log('Look for the "credentials" object around line 40');
    console.log();
    console.log('Replace:');
    console.log('  accessKey: "YOUR_ACCESS_KEY_HERE" → accessKey: "your-actual-access-key"');
    console.log('  secretKey: "YOUR_SECRET_KEY_HERE" → secretKey: "your-actual-secret-key"');
    console.log('  partnerTag: "YOUR_PARTNER_TAG_HERE" → partnerTag: "your-tag-20"');
    console.log();
    console.log('Then run this script again: npm run setup:amazon');
    process.exit(1);
  }
  
  return credentials;
}

function validateCredentials(credentials: AmazonCredentials): boolean {
  if (!credentials.accessKey || credentials.accessKey.length < 10) {
    console.log('❌ Access Key appears invalid (too short)');
    return false;
  }
  
  if (!credentials.secretKey || credentials.secretKey.length < 20) {
    console.log('❌ Secret Key appears invalid (too short)');
    return false;
  }
  
  if (!credentials.partnerTag || !credentials.partnerTag.includes('-')) {
    console.log('❌ Partner Tag appears invalid (should contain "-", usually ends with "-20")');
    return false;
  }
  
  return true;
}

async function main() {
  try {
    console.log('🚀 Setting up Amazon API Credentials...\n');
    
    const credentials = promptForCredentials();
    
    if (!validateCredentials(credentials)) {
      console.log('\n❌ Invalid credentials. Please check your values and try again.');
      process.exit(1);
    }
    
    updateEnvFile(credentials);
    
    console.log('✅ Credentials saved to .env.local');
    console.log();
    console.log('🧪 Testing credentials...');
    
    // Test the credentials by running the check script
    const { execSync } = require('child_process');
    try {
      execSync('npx tsx scripts/check-amazon-credentials.ts', { stdio: 'inherit' });
      console.log();
      console.log('🎉 Setup complete! You can now use the Amazon API.');
      console.log();
      console.log('Next steps:');
      console.log('  npm run test:amazon-api     # Test API functionality');
      console.log('  npm run test:prices        # Test complete price pipeline');
    } catch (error) {
      console.log('⚠️ Credentials saved but validation failed. Please check your keys.');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
