import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class WorkingAmazonScraper {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async searchAndSave(gameId: string, gameTitle: string): Promise<boolean> {
    console.log(`🔍 Scraping Amazon for: ${gameTitle}`);

    try {
      const searchQuery = `${gameTitle} board game`;
      const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&i=toys-and-games`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Connection': 'keep-alive'
        }
      });

      if (!response.ok) {
        console.log(`   ❌ Amazon returned ${response.status}`);
        return false;
      }

      const html = await response.text();
      
      // Parse for real products and prices
      const productData = this.parseAmazonResults(html, gameTitle);
      
      if (productData.length === 0) {
        console.log(`   ⚠️ No products found for ${gameTitle}`);
        return false;
      }

      // Save the best match to database
      const bestProduct = productData[0]; // First result is usually most relevant
      
      console.log(`   ✅ Found: ${bestProduct.title}`);
      console.log(`   💰 Price: $${bestProduct.price}`);
      
      // Save to database
      const priceData = {
        game_id: gameId,
        store_name: 'Amazon',
        price: bestProduct.price,
        currency: 'USD',
        url: bestProduct.url,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('game_prices')
        .upsert([priceData], { onConflict: 'game_id,store_name' });

      if (error) {
        console.log(`   ❌ Database error: ${error.message}`);
        return false;
      }

      console.log(`   ✅ Saved to database`);
      return true;

    } catch (error) {
      console.error(`   ❌ Error scraping ${gameTitle}:`, error);
      return false;
    }
  }

  private parseAmazonResults(html: string, gameTitle: string): Array<{title: string, price: number, url: string}> {
    const products: Array<{title: string, price: number, url: string}> = [];
    
    // Find product titles and URLs together
    const productLinkRegex = /href="([^"]*\/dp\/[A-Z0-9]{10}[^"]*)"/g;
    const productLinks: string[] = [];
    
    let linkMatch;
    while ((linkMatch = productLinkRegex.exec(html)) !== null && productLinks.length < 10) {
      const url = linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www.amazon.com${linkMatch[1]}`;
      productLinks.push(url);
    }

    // Find titles in the context of the HTML
    const titlePatterns = [
      /<span class="[^"]*a-size-[^"]*"[^>]*>([^<]+)</g,
      /<h2[^>]*>.*?<span[^>]*>([^<]+)</g,
      /data-cy="title-recipe-0"[^>]*>([^<]+)</g
    ];

    const foundTitles: string[] = [];
    titlePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && foundTitles.length < 10) {
        const title = match[1].trim()
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
        
        if (title.length > 10 && !foundTitles.includes(title)) {
          foundTitles.push(title);
        }
      }
    });

    // Find prices
    const prices: number[] = [];
    const priceRegex = /\$(\d+\.?\d*)/g;
    let priceMatch;
    while ((priceMatch = priceRegex.exec(html)) !== null && prices.length < 10) {
      const price = parseFloat(priceMatch[1]);
      if (price > 10 && price < 200) { // Reasonable board game price range
        prices.push(price);
      }
    }

    // Combine the data (match titles with prices and URLs)
    const maxResults = Math.min(foundTitles.length, prices.length, productLinks.length, 5);
    
    for (let i = 0; i < maxResults; i++) {
      products.push({
        title: foundTitles[i] || `${gameTitle} (Product ${i + 1})`,
        price: prices[i] || 0,
        url: productLinks[i] || `https://www.amazon.com/s?k=${encodeURIComponent(gameTitle)}`
      });
    }

    return products;
  }
}

async function testRealDatabaseScraping() {
  console.log('🚀 Testing Real Database Scraping');
  console.log('==================================\n');

  try {
    // Get some popular games from our database
    const { data: games, error } = await supabase
      .from('games')
      .select('id, title')
      .in('title', ['Wingspan', 'Azul', 'Splendor', 'Ticket to Ride'])
      .limit(4);

    if (error) {
      console.error('❌ Error fetching games:', error);
      return;
    }

    if (!games || games.length === 0) {
      console.log('❌ No games found in database');
      return;
    }

    console.log(`📊 Found ${games.length} games to test:`);
    games.forEach(game => console.log(`   • ${game.title} (${game.id})`));

    const scraper = new WorkingAmazonScraper();
    let successCount = 0;

    for (const game of games) {
      console.log(`\n🎲 Processing: ${game.title}`);
      console.log('-'.repeat(40));
      
      const success = await scraper.searchAndSave(game.id, game.title);
      if (success) successCount++;

      // Be respectful to Amazon
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log(`\n📊 Summary: ${successCount}/${games.length} games successfully scraped`);

    // Query the results
    console.log('\n🔍 Checking stored prices...');
    const { data: prices, error: priceError } = await supabase
      .from('game_prices')
      .select('*')
      .eq('store_name', 'Amazon')
      .in('game_id', games.map(g => g.id));

    if (priceError) {
      console.error('❌ Error fetching prices:', priceError);
    } else {
      console.log(`✅ Found ${prices?.length} stored prices:`);
      prices?.forEach(price => {
        const game = games.find(g => g.id === price.game_id);
        console.log(`   • ${game?.title}: $${price.price} (${price.url})`);
      });
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

testRealDatabaseScraping();
