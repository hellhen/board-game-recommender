import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

class ProductionAmazonScraper {
  private userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async scrapeBulkPrices(games: Array<{id: string, title: string}>, maxGames = 10): Promise<number> {
    console.log(`🚀 Starting bulk Amazon price scraping for ${Math.min(games.length, maxGames)} games`);
    console.log('='.repeat(70));
    
    let successCount = 0;
    const limitedGames = games.slice(0, maxGames);

    for (const [index, game] of limitedGames.entries()) {
      console.log(`\n📦 [${index + 1}/${limitedGames.length}] ${game.title}`);
      console.log('-'.repeat(50));

      try {
        const success = await this.scrapeAndSave(game.id, game.title);
        if (success) {
          successCount++;
          console.log('   ✅ Successfully scraped and saved');
        } else {
          console.log('   ❌ Scraping failed');
        }
      } catch (error) {
        console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      // Rate limiting - be respectful to Amazon
      if (index < limitedGames.length - 1) {
        const delay = 4000 + Math.random() * 2000; // 4-6 seconds
        console.log(`   ⏳ Waiting ${Math.round(delay/1000)}s before next request...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`\n🎉 Bulk scraping complete: ${successCount}/${limitedGames.length} games successfully scraped`);
    return successCount;
  }

  private async scrapeAndSave(gameId: string, gameTitle: string): Promise<boolean> {
    try {
      const searchQuery = `${gameTitle} board game`;
      const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}&i=toys-and-games`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Cache-Control': 'max-age=0'
        }
      });

      if (response.status === 503) {
        console.log('   ⚠️ Amazon bot detection (503) - skipping');
        return false;
      }

      if (!response.ok) {
        console.log(`   ❌ HTTP ${response.status}`);
        return false;
      }

      const html = await response.text();
      const productData = this.parseAmazonSearch(html, gameTitle);
      
      if (!productData) {
        console.log('   ⚠️ No valid product data found');
        return false;
      }

      console.log(`   🎯 Found: ${productData.title.substring(0, 60)}...`);
      console.log(`   💰 Price: $${productData.price}`);
      
      // Save to database
      const priceRecord = {
        game_id: gameId,
        store_name: 'Amazon',
        price: productData.price,
        currency: 'USD',
        url: productData.url,
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('game_prices')
        .upsert([priceRecord], { onConflict: 'game_id,store_name' });

      if (error) {
        console.log(`   ❌ Database error: ${error.message}`);
        return false;
      }

      return true;

    } catch (error) {
      console.log(`   ❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  private parseAmazonSearch(html: string, gameTitle: string): {title: string, price: number, url: string} | null {
    // Find product URLs first
    const productLinkRegex = /href="([^"]*\/dp\/[A-Z0-9]{10}[^"]*)"/g;
    const urls: string[] = [];
    
    let linkMatch;
    while ((linkMatch = productLinkRegex.exec(html)) !== null && urls.length < 5) {
      const url = linkMatch[1].startsWith('http') ? linkMatch[1] : `https://www.amazon.com${linkMatch[1]}`;
      urls.push(url);
    }

    // Find titles
    const titlePatterns = [
      /<span class="[^"]*a-size-[^"]*"[^>]*>([^<]{10,})<\/span>/g,
      /<h2[^>]*>.*?<span[^>]*>([^<]{10,})<\/span>/g,
      /data-cy="title[^"]*"[^>]*>([^<]{10,})</g
    ];

    const titles: string[] = [];
    titlePatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(html)) !== null && titles.length < 5) {
        const title = match[1].trim()
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"');
        
        if (title.length > 15 && title.length < 200 && !titles.includes(title)) {
          titles.push(title);
        }
      }
    });

    // Find prices
    const priceRegex = /\$(\d{1,3}\.?\d{0,2})/g;
    const prices: number[] = [];
    let priceMatch;
    
    while ((priceMatch = priceRegex.exec(html)) !== null && prices.length < 10) {
      const price = parseFloat(priceMatch[1]);
      if (price >= 15 && price <= 150) { // Reasonable board game price range
        prices.push(price);
      }
    }

    // Return the best combination
    if (titles.length > 0 && prices.length > 0 && urls.length > 0) {
      return {
        title: titles[0],
        price: prices[0],
        url: urls[0]
      };
    }

    return null;
  }
}

async function scrapeBestGames() {
  console.log('🎯 Scraping Prices for Popular Board Games');
  console.log('==========================================\n');

  try {
    // Get popular games that likely need price updates
    const { data: games, error } = await supabase
      .from('games')
      .select('id, title')
      .in('title', [
        'Wingspan', 'Azul', 'Splendor', 'Ticket to Ride', 'Catan',
        '7 Wonders', 'Pandemic', 'King of Tokyo', 'Dominion', 'Gloomhaven'
      ])
      .limit(10);

    if (error) {
      console.error('❌ Database error:', error);
      return;
    }

    if (!games || games.length === 0) {
      console.log('❌ No games found');
      return;
    }

    console.log(`📊 Found ${games.length} popular games in database`);
    games.forEach((game, i) => console.log(`   ${i + 1}. ${game.title}`));

    const scraper = new ProductionAmazonScraper();
    const successCount = await scraper.scrapeBulkPrices(games, 8); // Scrape 8 games max

    // Show results
    console.log('\n📊 Final Results:');
    console.log('='.repeat(50));
    
    const { data: prices, error: priceError } = await supabase
      .from('game_prices')
      .select(`
        *,
        games(title)
      `)
      .eq('store_name', 'Amazon')
      .in('game_id', games.map(g => g.id))
      .order('last_updated', { ascending: false });

    if (priceError) {
      console.error('❌ Error fetching results:', priceError);
    } else {
      console.log(`✅ Successfully stored ${prices?.length} Amazon prices:`);
      prices?.forEach(price => {
        const gameTitle = (price as any).games?.title || 'Unknown Game';
        console.log(`   🎲 ${gameTitle}: $${price.price}`);
        console.log(`      🔗 ${price.url.substring(0, 80)}...`);
      });
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }
}

scrapeBestGames();
