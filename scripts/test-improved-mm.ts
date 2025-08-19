import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testImprovedMiniatureMarket() {
  console.log('🏪 Testing Improved Miniature Market Scraping');
  console.log('=============================================\n');

  // Try multiple search approaches
  const game = 'Wingspan';
  const searchApproaches = [
    `https://www.miniaturemarket.com/searchresults/?q=${encodeURIComponent(game)}`,
    `https://www.miniaturemarket.com/catalogsearch/result/?q=${encodeURIComponent(game)}`,
    `https://www.miniaturemarket.com/search?q=${encodeURIComponent(game)}`
  ];

  for (const [index, url] of searchApproaches.entries()) {
    console.log(`\n🔍 Approach ${index + 1}: ${url}`);
    console.log('-'.repeat(60));

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.miniaturemarket.com/',
          'Connection': 'keep-alive'
        }
      });

      console.log(`Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log('❌ Request failed');
        continue;
      }

      const html = await response.text();
      console.log(`📄 Response length: ${html.length}`);

      // Parse the response
      const results = parseImprovedMiniatureMarket(html, game);
      
      console.log(`📊 Parsing results:`);
      console.log(`   Products found: ${results.products.length}`);
      console.log(`   Prices found: ${results.prices.length}`);
      console.log(`   Links found: ${results.links.length}`);

      if (results.products.length > 0) {
        console.log(`🎯 Sample products:`);
        results.products.slice(0, 3).forEach((product, i) => {
          console.log(`   ${i + 1}: ${product}`);
        });
      }

      if (results.prices.length > 0) {
        console.log(`💰 Sample prices:`);
        results.prices.slice(0, 3).forEach((price, i) => {
          console.log(`   ${i + 1}: $${price}`);
        });
      }

      // If this approach found products, it's the best one
      if (results.products.length > 0 && results.prices.length > 0) {
        console.log(`✅ Best approach found: Approach ${index + 1}`);
        break;
      }

    } catch (error) {
      console.error(`❌ Error with approach ${index + 1}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between requests
  }
}

function parseImprovedMiniatureMarket(html: string, gameTitle: string) {
  const results = {
    products: [] as string[],
    prices: [] as number[],
    links: [] as string[]
  };

  // Enhanced product title patterns
  const titlePatterns = [
    // Standard product titles with links
    /<a[^>]*href="[^"]*"[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)</gi,
    /<a[^>]*class="[^"]*product[^"]*"[^>]*href="[^"]*"[^>]*>([^<]+)</gi,
    // Product name spans and divs
    /<span[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)</gi,
    /<div[^>]*class="[^"]*product-name[^"]*"[^>]*>([^<]+)</gi,
    /<h2[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)</gi,
    /<h3[^>]*class="[^"]*product[^"]*"[^>]*>([^<]+)</gi,
    // Title attributes
    /title="([^"]*wing[^"]*)"[^>]*>/gi,
    // Any element with wingspan in the text
    />([^<]*[Ww]ingspan[^<]*)</g
  ];

  titlePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const title = match[1].trim()
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"');
      
      if (title.length > 3 && title.length < 200 && !results.products.includes(title)) {
        results.products.push(title);
      }
    }
  });

  // Enhanced price patterns
  const pricePatterns = [
    // Standard dollar amounts
    /\$(\d+\.?\d*)/g,
    // Price in specific contexts
    /<span[^>]*class="[^"]*price[^"]*"[^>]*>[^$]*\$(\d+\.?\d*)/gi,
    /<div[^>]*class="[^"]*price[^"]*"[^>]*>[^$]*\$(\d+\.?\d*)/gi,
    // JSON-like data
    /"price":"[^"]*\$?(\d+\.?\d*)"/gi,
    // Data attributes
    /data-price="[^"]*\$?(\d+\.?\d*)"/gi
  ];

  pricePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const price = parseFloat(match[1]);
      if (price > 5 && price < 500) { // Reasonable board game price range
        results.prices.push(price);
      }
    }
  });

  // Enhanced link patterns
  const linkPatterns = [
    // Product page links
    /href="([^"]*\/[^"]*\.html[^"]*)"[^>]*>/gi,
    // Category or product links containing the game name
    new RegExp(`href="([^"]*${gameTitle.toLowerCase()}[^"]*)"[^>]*>`, 'gi'),
    // General product links
    /href="([^"]*\/product[^"]*)"[^>]*>/gi
  ];

  linkPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      let link = match[1];
      if (!link.startsWith('http') && !link.startsWith('//')) {
        link = 'https://www.miniaturemarket.com' + link;
      }
      if (!results.links.includes(link)) {
        results.links.push(link);
      }
    }
  });

  return results;
}

testImprovedMiniatureMarket();
