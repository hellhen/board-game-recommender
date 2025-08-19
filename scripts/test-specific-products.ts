import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testWithSpecificProducts() {
  console.log('🎯 Testing with Known Available Products');
  console.log('=======================================\n');

  // Let's try with games that are more likely to be in stock at Miniature Market
  const testGames = ['Catan', 'Monopoly', 'Risk', 'Chess', 'Scrabble'];

  for (const game of testGames) {
    console.log(`\n🎲 Testing: ${game}`);
    console.log('='.repeat(30));

    const searchUrl = `https://www.miniaturemarket.com/searchresults/?q=${encodeURIComponent(game)}`;
    
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
      
      // Look specifically for actual product listings, not just page metadata
      const productData = extractRealProducts(html, game);
      
      console.log(`📊 Found: ${productData.realProducts.length} products, ${productData.realPrices.length} prices`);
      
      if (productData.realProducts.length > 0) {
        console.log('🎯 Products:');
        productData.realProducts.forEach((product, i) => {
          const price = productData.realPrices[i] || 'No price';
          console.log(`   • ${product} - ${price}`);
        });
        
        // If we find real products, this is working!
        if (productData.realProducts.length > 0 && productData.realPrices.length > 0) {
          console.log(`✅ Successfully scraped ${game}!`);
        }
      } else {
        console.log('⚠️ No real products found');
      }

    } catch (error) {
      console.error(`❌ Error testing ${game}:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

function extractRealProducts(html: string, gameTitle: string) {
  const results = {
    realProducts: [] as string[],
    realPrices: [] as string[],
    productUrls: [] as string[]
  };

  // Look for more specific product patterns
  // Check if there's actually a "No results found" or similar message
  const noResultsPatterns = [
    /no products found/i,
    /no results/i,
    /we couldn't find/i,
    /0 results/i
  ];

  const hasNoResults = noResultsPatterns.some(pattern => pattern.test(html));
  
  if (hasNoResults) {
    console.log('   📝 Search returned no results');
    return results;
  }

  // Look for actual product containers
  // Common e-commerce patterns
  const productContainerRegex = /<div[^>]*class="[^"]*(?:product-item|item-product|search-item)[^"]*"[^>]*>(.*?)<\/div>/gis;
  let productContainers: string[] = [];
  
  const initialMatches = html.match(productContainerRegex);
  if (initialMatches) {
    productContainers = initialMatches;
  }
  
  console.log(`   🔍 Found ${productContainers.length} potential product containers`);

  if (productContainers.length === 0) {
    // Try alternative patterns
    const altPatterns = [
      /<li[^>]*class="[^"]*product[^"]*"[^>]*>(.*?)<\/li>/gis,
      /<article[^>]*class="[^"]*product[^"]*"[^>]*>(.*?)<\/article>/gis,
      /<section[^>]*class="[^"]*product[^"]*"[^>]*>(.*?)<\/section>/gis
    ];

    altPatterns.forEach((pattern, index) => {
      const matches = html.match(pattern);
      if (matches) {
        console.log(`   🔍 Alternative pattern ${index + 1}: ${matches.length} matches`);
        productContainers = productContainers.concat(matches);
      }
    });
  }

  // Parse each product container
  productContainers.forEach((container, index) => {
    if (index < 10) { // Limit to first 10 to avoid noise
      const productInfo = parseProductContainer(container, gameTitle);
      if (productInfo.title && productInfo.title.length > 5) {
        results.realProducts.push(productInfo.title);
        results.realPrices.push(productInfo.price || 'No price');
        if (productInfo.url) {
          results.productUrls.push(productInfo.url);
        }
      }
    }
  });

  // If no structured products found, try a simpler approach
  if (results.realProducts.length === 0) {
    console.log('   🔄 Trying simpler extraction...');
    
    // Look for any text that might be product names near prices
    const priceContext = /(.{20,100})\$(\d+\.?\d*)/g;
    let match;
    while ((match = priceContext.exec(html)) !== null && results.realProducts.length < 5) {
      const context = match[1].replace(/<[^>]+>/g, '').trim();
      const price = `$${match[2]}`;
      
      if (context.length > 10 && context.length < 100 && !context.includes('Search') && !context.includes('Page')) {
        results.realProducts.push(context);
        results.realPrices.push(price);
      }
    }
  }

  return results;
}

function parseProductContainer(containerHtml: string, gameTitle: string) {
  const result = {
    title: '',
    price: '',
    url: ''
  };

  // Extract title
  const titlePatterns = [
    /<h[1-6][^>]*>(.*?)<\/h[1-6]>/i,
    /<a[^>]*title="([^"]*)"[^>]*>/i,
    /<span[^>]*class="[^"]*title[^"]*"[^>]*>(.*?)<\/span>/i,
    /<div[^>]*class="[^"]*name[^"]*"[^>]*>(.*?)<\/div>/i
  ];

  for (const pattern of titlePatterns) {
    const match = containerHtml.match(pattern);
    if (match) {
      result.title = match[1].replace(/<[^>]+>/g, '').trim();
      break;
    }
  }

  // Extract price
  const priceMatch = containerHtml.match(/\$(\d+\.?\d*)/);
  if (priceMatch) {
    result.price = `$${priceMatch[1]}`;
  }

  // Extract URL
  const urlMatch = containerHtml.match(/href="([^"]*)"/);
  if (urlMatch) {
    result.url = urlMatch[1];
    if (!result.url.startsWith('http')) {
      result.url = 'https://www.miniaturemarket.com' + result.url;
    }
  }

  return result;
}

testWithSpecificProducts();
