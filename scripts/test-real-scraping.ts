import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Popular board games to test with
const testGames = [
  'Wingspan',
  'Azul',
  'Splendor', 
  'Ticket to Ride',
  'Catan'
];

class AdvancedAmazonScraper {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/91.0.864.59',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async sleep(ms = 2000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchGame(gameTitle: string): Promise<any> {
    const searchQuery = `${gameTitle} board game`;
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&i=toys-and-games`;
    
    console.log(`🔍 Searching Amazon for: "${gameTitle}"`);
    console.log(`   URL: ${searchUrl}`);
    
    try {
      const headers = {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      };

      const response = await fetch(searchUrl, { 
        headers,
        method: 'GET',
        redirect: 'follow'
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Response headers:`, Object.fromEntries(response.headers.entries()));

      if (response.status === 503) {
        console.log(`   ⚠️  Amazon detected bot behavior (503)`);
        return { success: false, error: 'Bot detected', status: 503 };
      }

      if (!response.ok) {
        console.log(`   ❌ Request failed with status ${response.status}`);
        return { success: false, error: `HTTP ${response.status}`, status: response.status };
      }

      const html = await response.text();
      console.log(`   📄 Response length: ${html.length} characters`);
      
      // Check for common Amazon anti-bot pages
      if (html.includes('Robot Check') || html.includes('Captcha')) {
        console.log(`   🤖 Amazon requires CAPTCHA/Robot check`);
        return { success: false, error: 'CAPTCHA required', captcha: true };
      }

      if (html.includes('Sorry! Something went wrong')) {
        console.log(`   ⚠️  Amazon error page detected`);
        return { success: false, error: 'Amazon error page' };
      }

      // Look for product data
      const productInfo = this.parseSearchResults(html, gameTitle);
      return { success: true, html: html.substring(0, 1000), ...productInfo };

    } catch (error) {
      console.error(`   ❌ Network error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private parseSearchResults(html: string, gameTitle: string): any {
    // Look for product cards and prices
    const results = {
      foundProducts: 0,
      prices: [] as any[],
      titles: [] as string[]
    };

    // Find product titles (multiple patterns)
    const titlePatterns = [
      /data-cy="title-recipe-0"[^>]*>([^<]+)</g,
      /<h2[^>]*>.*?<span[^>]*>([^<]+)</g,
      /<span class="[^"]*a-size-[^"]*"[^>]*>([^<]+)</g
    ];

    titlePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && results.titles.length < 10) {
        const title = match[1].trim();
        if (title.length > 10 && !results.titles.includes(title)) {
          results.titles.push(title);
        }
      }
    });

    // Find prices
    const pricePatterns = [
      /\$(\d+\.?\d*)/g,
      /"price":"[^"]*\$(\d+\.?\d*)/g
    ];

    pricePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && results.prices.length < 10) {
        const price = parseFloat(match[1]);
        if (price > 5 && price < 500) { // Reasonable board game price range
          results.prices.push(price);
        }
      }
    });

    results.foundProducts = Math.min(results.titles.length, results.prices.length);
    
    console.log(`   📊 Found ${results.titles.length} titles, ${results.prices.length} prices`);
    if (results.titles.length > 0) {
      console.log(`   🎯 Sample titles: ${results.titles.slice(0, 3).join(', ')}`);
    }
    if (results.prices.length > 0) {
      console.log(`   💰 Sample prices: $${results.prices.slice(0, 3).join(', $')}`);
    }

    return results;
  }
}

class AdvancedMiniatureMarketScraper {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async sleep(ms = 1000): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async searchGame(gameTitle: string): Promise<any> {
    const searchQuery = gameTitle;
    const searchUrl = `https://www.miniaturemarket.com/catalogsearch/result/?q=${encodeURIComponent(searchQuery)}`;
    
    console.log(`🏪 Searching Miniature Market for: "${gameTitle}"`);
    console.log(`   URL: ${searchUrl}`);
    
    try {
      const headers = {
        'User-Agent': this.getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Referer': 'https://www.miniaturemarket.com/',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      };

      const response = await fetch(searchUrl, { 
        headers,
        method: 'GET',
        redirect: 'follow'
      });

      console.log(`   Status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.log(`   ❌ Request failed with status ${response.status}`);
        return { success: false, error: `HTTP ${response.status}`, status: response.status };
      }

      const html = await response.text();
      console.log(`   📄 Response length: ${html.length} characters`);
      
      // Look for product data
      const productInfo = this.parseSearchResults(html, gameTitle);
      return { success: true, html: html.substring(0, 1000), ...productInfo };

    } catch (error) {
      console.error(`   ❌ Network error:`, error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private parseSearchResults(html: string, gameTitle: string): any {
    const results = {
      foundProducts: 0,
      prices: [] as any[],
      titles: [] as string[],
      urls: [] as string[]
    };

    // Find product titles - Miniature Market specific patterns
    const titlePatterns = [
      /<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*>([^<]+)</g,
      /<span[^>]*class="[^"]*product name[^"]*"[^>]*>([^<]+)</g,
      /<h3[^>]*class="[^"]*product-name[^"]*"[^>]*>.*?<a[^>]*>([^<]+)</g
    ];

    titlePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && results.titles.length < 10) {
        const title = match[1].trim().replace(/\s+/g, ' ');
        if (title.length > 5 && !results.titles.includes(title)) {
          results.titles.push(title);
        }
      }
    });

    // Find prices - Miniature Market specific patterns  
    const pricePatterns = [
      /class="[^"]*price[^"]*"[^>]*>\s*\$(\d+\.?\d*)/g,
      /"price":\s*"?\$?(\d+\.?\d*)/g,
      /\$(\d+\.?\d*)/g
    ];

    pricePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && results.prices.length < 10) {
        const price = parseFloat(match[1]);
        if (price > 5 && price < 500) { // Reasonable board game price range
          results.prices.push(price);
        }
      }
    });

    // Find product URLs
    const urlPattern = /<a[^>]*href="([^"]*)"[^>]*class="[^"]*product-item-link[^"]*"/g;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(html)) !== null && results.urls.length < 10) {
      let url = urlMatch[1];
      if (!url.startsWith('http')) {
        url = 'https://www.miniaturemarket.com' + url;
      }
      results.urls.push(url);
    }

    results.foundProducts = Math.min(results.titles.length, results.prices.length);
    
    console.log(`   📊 Found ${results.titles.length} titles, ${results.prices.length} prices, ${results.urls.length} URLs`);
    if (results.titles.length > 0) {
      console.log(`   🎯 Sample titles: ${results.titles.slice(0, 3).join(', ')}`);
    }
    if (results.prices.length > 0) {
      console.log(`   💰 Sample prices: $${results.prices.slice(0, 3).join(', $')}`);
    }

    return results;
  }
}

async function testRealScraping() {
  console.log('🚀 Testing Real Game Scraping');
  console.log('============================\n');

  const amazonScraper = new AdvancedAmazonScraper();
  const mmScraper = new AdvancedMiniatureMarketScraper();

  for (const game of testGames) {
    console.log(`\n🎲 Testing game: ${game}`);
    console.log('='.repeat(40));

    // Test Amazon
    const amazonResult = await amazonScraper.searchGame(game);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait between requests

    // Test Miniature Market
    const mmResult = await mmScraper.searchGame(game);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait between requests

    // Summary for this game
    console.log(`\n📊 Summary for ${game}:`);
    console.log(`   Amazon: ${amazonResult.success ? `✅ Found ${amazonResult.foundProducts} products` : `❌ ${amazonResult.error}`}`);
    console.log(`   Miniature Market: ${mmResult.success ? `✅ Found ${mmResult.foundProducts} products` : `❌ ${mmResult.error}`}`);
  }

  console.log('\n✅ Real scraping test completed');
}

testRealScraping();
