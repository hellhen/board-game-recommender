import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

// Create Supabase client with proper environment loading
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface GameRecord {
  id: string;
  title: string;
  bgg_id?: number;
}

interface PriceUpdateResult {
  gameId: string;
  gameTitle: string;
  success: boolean;
  price?: number;
  url?: string;
  asin?: string;
  error?: string;
}

async function getTopGames(limit: number = 200): Promise<GameRecord[]> {
  console.log(`🎯 Fetching top ${limit} games from database...`);

  try {
    // Get games ordered by BGG ranking if available, otherwise by title
    const { data: games, error } = await supabase
      .from('games')
      .select('id, title, bgg_id')
      .order('bgg_id', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('❌ Failed to fetch games:', error.message);
      return [];
    }

    console.log(`✅ Found ${games?.length || 0} games in database`);
    return games || [];

  } catch (error) {
    console.error('❌ Database query failed:', error);
    return [];
  }
}

async function savePriceToDatabase(gameId: string, price: number, url: string, asin: string): Promise<boolean> {
  try {
    const priceData = {
      game_id: gameId,
      store_name: 'Amazon',
      price: price,
      currency: 'USD',
      url: url,
      last_updated: new Date().toISOString()
    };

    // Use upsert to update existing records or insert new ones
    const { error } = await supabase
      .from('game_prices')
      .upsert([priceData], { 
        onConflict: 'game_id,store_name',
        ignoreDuplicates: false 
      });

    if (error) {
      console.error('❌ Database save error:', error.message);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Save to database failed:', error);
    return false;
  }
}

async function updateGamePrice(game: GameRecord): Promise<PriceUpdateResult> {
  const result: PriceUpdateResult = {
    gameId: game.id,
    gameTitle: game.title,
    success: false
  };

  try {
    console.log(`🔍 Searching Amazon for: ${game.title}`);

    // Dynamic import to ensure environment variables are loaded
    const { amazonAPIService } = await import('../lib/amazon-api-service');

    // Search Amazon for the game
    const searchResult = await amazonAPIService.searchBoardGames(game.title, {
      maxResults: 5,
      sortBy: 'Relevance',
      minReviewsRating: 3
    });

    if (!searchResult.success) {
      result.error = searchResult.error || 'Amazon search failed';
      return result;
    }

    if (!searchResult.items || searchResult.items.length === 0) {
      result.error = 'No Amazon results found';
      return result;
    }

    // Find the best match (first result with a reasonable price)
    const validProducts = searchResult.items.filter(item => 
      item.price && 
      item.price > 10 && // Avoid accessories/cheap items
      item.price < 500 && // Avoid extremely expensive items
      item.asin &&
      item.url
    );

    if (validProducts.length === 0) {
      result.error = 'No valid products with prices found';
      return result;
    }

    const bestMatch = validProducts[0];
    
    // Save to database
    const saved = await savePriceToDatabase(
      game.id, 
      bestMatch.price!, 
      bestMatch.url, 
      bestMatch.asin
    );

    if (!saved) {
      result.error = 'Failed to save to database';
      return result;
    }

    // Success!
    result.success = true;
    result.price = bestMatch.price;
    result.url = bestMatch.url;
    result.asin = bestMatch.asin;

    console.log(`   ✅ Updated: $${bestMatch.price} - ${bestMatch.title?.substring(0, 50)}...`);
    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Error: ${result.error}`);
    return result;
  }
}

async function runPriceUpdate(maxGames: number = 50) {
  console.log('🚀 Starting Amazon Price Update');
  console.log('=' .repeat(60));

  // Dynamic import to ensure environment variables are loaded
  const { amazonAPIService } = await import('../lib/amazon-api-service');

  // Check Amazon API availability
  if (!amazonAPIService.isAvailable()) {
    console.error('❌ Amazon API not available. Check credentials.');
    return;
  }

  console.log('✅ Amazon API is available');

  // Get games from database
  const games = await getTopGames(maxGames);
  
  if (games.length === 0) {
    console.error('❌ No games found in database');
    return;
  }

  console.log(`🎯 Updating prices for ${games.length} games\n`);

  const results: PriceUpdateResult[] = [];
  const batchSize = 10; // Process in smaller batches
  
  for (let i = 0; i < games.length; i += batchSize) {
    const batch = games.slice(i, i + batchSize);
    console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(games.length / batchSize)} (games ${i + 1}-${Math.min(i + batchSize, games.length)})`);

    for (let j = 0; j < batch.length; j++) {
      const game = batch[j];
      const gameIndex = i + j + 1;
      
      console.log(`[${gameIndex}/${games.length}] 🎲 ${game.title}`);
      
      const result = await updateGamePrice(game);
      results.push(result);

      // Rate limiting - wait 3 seconds between requests
      if (gameIndex < games.length) {
        console.log(`   ⏳ Waiting 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log(); // Empty line between batches
  }

  // Summary Report
  console.log('=' .repeat(60));
  console.log('📊 PRICE UPDATE SUMMARY');
  console.log('=' .repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`✅ Successfully updated: ${successful.length}/${games.length} games`);
  console.log(`❌ Failed to update: ${failed.length}/${games.length} games`);
  console.log();

  if (successful.length > 0) {
    const prices = successful.map(r => r.price!);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    console.log('💰 PRICE STATISTICS:');
    console.log(`   Average Price: $${avgPrice.toFixed(2)}`);
    console.log(`   Price Range: $${minPrice} - $${maxPrice}`);
    console.log(`   Total Value: $${prices.reduce((sum, price) => sum + price, 0).toFixed(2)}`);
    console.log();

    console.log('🎯 SAMPLE SUCCESSFUL UPDATES:');
    successful.slice(0, 10).forEach(result => {
      console.log(`   ${result.gameTitle}: $${result.price}`);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log('⚠️  FAILED UPDATES (sample):');
    failed.slice(0, 10).forEach(result => {
      console.log(`   ${result.gameTitle}: ${result.error}`);
    });
    console.log();
  }

  console.log('🏁 Price update completed!');
  
  if (successful.length > 0) {
    console.log('💾 Prices have been saved to the database');
    console.log('🔍 You can query the game_prices table to see the results');
  }
}

// Check command line arguments
const args = process.argv.slice(2);
const maxGames = args.length > 0 ? parseInt(args[0]) : 20; // Default to 20 games for testing

if (isNaN(maxGames) || maxGames < 1 || maxGames > 1000) {
  console.error('❌ Invalid number of games. Use: npx tsx scripts/update-prices.ts [number]');
  console.log('Examples:');
  console.log('  npx tsx scripts/update-prices.ts 10    # Update 10 games');
  console.log('  npx tsx scripts/update-prices.ts 50    # Update 50 games');
  console.log('  npx tsx scripts/update-prices.ts       # Update 20 games (default)');
  process.exit(1);
}

console.log(`🎯 Will update prices for up to ${maxGames} games`);
console.log('⚠️  This will make API calls to Amazon and update your database');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

// Give user a chance to cancel
setTimeout(() => {
  runPriceUpdate(maxGames).catch(error => {
    console.error('❌ Price update failed:', error);
    process.exit(1);
  });
}, 5000);
