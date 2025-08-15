import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function debugMiniatureMarket() {
  console.log('🔍 Debugging Miniature Market HTML Structure');
  console.log('============================================\n');

  const searchUrl = 'https://www.miniaturemarket.com/catalogsearch/result/?q=Wingspan';
  
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.miniaturemarket.com/'
      }
    });

    const html = await response.text();
    console.log(`📄 HTML Length: ${html.length}`);
    
    // Let's look for common patterns in the HTML
    console.log('\n🔍 Looking for product patterns...\n');

    // Check for common e-commerce class names
    const patterns = [
      'product-item',
      'product-name',
      'price',
      'item-title',
      'product-title',
      'catalog-item'
    ];

    patterns.forEach(pattern => {
      const regex = new RegExp(`class="[^"]*${pattern}[^"]*"`, 'gi');
      const matches = html.match(regex);
      if (matches) {
        console.log(`✅ Found ${matches.length} "${pattern}" elements`);
        console.log(`   Sample: ${matches[0]}`);
      } else {
        console.log(`❌ No "${pattern}" elements found`);
      }
    });

    // Look for product links
    console.log('\n🔗 Looking for product links...\n');
    const linkPatterns = [
      /href="([^"]*\/[^"]*\.html[^"]*)"[^>]*>/gi,
      /href="([^"]*products[^"]*)"[^>]*>/gi,
      /href="([^"]*wing[^"]*)"[^>]*>/gi
    ];

    linkPatterns.forEach((pattern, index) => {
      const matches = Array.from(html.matchAll(pattern));
      if (matches.length > 0) {
        console.log(`✅ Link pattern ${index + 1}: Found ${matches.length} matches`);
        matches.slice(0, 3).forEach((match, i) => {
          console.log(`   ${i + 1}: ${match[1]}`);
        });
      } else {
        console.log(`❌ Link pattern ${index + 1}: No matches`);
      }
    });

    // Look for prices
    console.log('\n💰 Looking for price patterns...\n');
    const pricePatterns = [
      /\$(\d+\.?\d*)/g,
      /price[^>]*>([^<]*\$[^<]*)</gi,
      /\$[\d,]+\.?\d*/g
    ];

    pricePatterns.forEach((pattern, index) => {
      const matches = Array.from(html.matchAll(pattern));
      if (matches.length > 0) {
        console.log(`✅ Price pattern ${index + 1}: Found ${matches.length} matches`);
        matches.slice(0, 5).forEach((match, i) => {
          console.log(`   ${i + 1}: ${match[0]}`);
        });
      } else {
        console.log(`❌ Price pattern ${index + 1}: No matches`);
      }
    });

    // Save a sample of the HTML for manual inspection
    console.log('\n📄 Saving HTML sample...\n');
    const htmlSample = html.substring(0, 5000);
    console.log('First 1000 characters:');
    console.log('='.repeat(50));
    console.log(htmlSample.substring(0, 1000));
    console.log('='.repeat(50));

    // Look for JavaScript that might be loading products dynamically
    if (html.includes('react') || html.includes('angular') || html.includes('vue')) {
      console.log('⚠️ Site appears to use JavaScript framework - products may load dynamically');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

debugMiniatureMarket();
