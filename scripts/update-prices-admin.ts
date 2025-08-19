import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

// Create Supabase client with SERVICE ROLE for elevated permissions
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables (need service role key)');
  process.exit(1);
}

// Use service role client for database operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  error?: string;
}

async function testDatabaseAccess() {
  console.log('🧪 Testing database access with service role...');

  try {
    // Test read access
    const { data: games, error: readError } = await supabase
      .from('games')
      .select('id, title')
      .limit(1);

    if (readError) {
      console.error('❌ Read test failed:', readError.message);
      return false;
    }

    console.log('✅ Read access works');

    // Test insert access with a temporary record
    const testData = {
      game_id: games![0].id,
      store_name: 'TEST_STORE_DELETE_ME',
      price: 99.99,
      currency: 'USD',
      url: 'https://test.com',
      last_updated: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('game_prices')
      .insert([testData])
      .select();

    if (insertError) {
      console.error('❌ Insert test failed:', insertError.message);
      return false;
    }

    console.log('✅ Insert access works');

    // Clean up test record
    await supabase
      .from('game_prices')
      .delete()
      .eq('store_name', 'TEST_STORE_DELETE_ME');

    console.log('✅ Database access is fully functional with service role');
    return true;

  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

async function getAllGames(): Promise<GameRecord[]> {
  console.log(`🎯 Fetching ALL games from database with pagination...`);

  try {
    // First, get the total count
    const { count, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Failed to count games:', countError.message);
      return [];
    }

    console.log(`📊 Found ${count} total games in database`);

    const allGames: GameRecord[] = [];
    const batchSize = 1000;
    let offset = 0;

    // Fetch games in batches to avoid Supabase's 1000 row limit
    while (true) {
      console.log(`🔍 Fetching batch: ${offset} to ${offset + batchSize - 1}`);
      
      const { data: gameBatch, error: gamesError } = await supabase
        .from('games')
        .select('id, title, bgg_id')
        .order('bgg_id', { ascending: true, nullsFirst: false })
        .range(offset, offset + batchSize - 1);

      if (gamesError) {
        console.error('❌ Failed to fetch games batch:', gamesError.message);
        return allGames; // Return what we have so far
      }

      if (!gameBatch || gameBatch.length === 0) {
        break; // No more games to fetch
      }

      allGames.push(...gameBatch);
      console.log(`🔍 Fetched ${gameBatch.length} games, total so far: ${allGames.length}`);

      // If we got fewer than the batch size, we've reached the end
      if (gameBatch.length < batchSize) {
        break;
      }

      offset += batchSize;
    }

    console.log(`✅ Successfully fetched all ${allGames.length} games from database`);
    console.log(`🎯 Will process all ${allGames.length} games (overwriting existing prices)`);
    
    return allGames;

  } catch (error) {
    console.error('❌ Database query failed:', error);
    return [];
  }
}

async function savePriceToDatabase(gameId: string, price: number, url: string): Promise<boolean> {
  try {
    const priceData = {
      game_id: gameId,
      store_name: 'Amazon',
      price: price,
      currency: 'USD',
      url: url,
      last_updated: new Date().toISOString()
    };

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

    // Find valid products with reasonable prices
    const validProducts = searchResult.items.filter(item => 
      item.price && 
      item.price > 10 && 
      item.price < 500 && 
      item.url
    );

    if (validProducts.length === 0) {
      result.error = 'No valid products with prices found';
      return result;
    }

    // Use the Amazon API service's intelligent matching instead of just taking the first result
    console.log(`    📊 Found ${validProducts.length} valid products, running intelligent matching...`);
    const bestMatch = (amazonAPIService as any).findBestMatch(game.title, validProducts);
    
    if (!bestMatch || !bestMatch.price) {
      result.error = 'No suitable match found after intelligent filtering';
      console.log(`    ❌ Intelligent matching rejected all products for "${game.title}"`);
      return result;
    }
    
    // Save to database
    const saved = await savePriceToDatabase(
      game.id, 
      bestMatch.price!, 
      bestMatch.url
    );

    if (!saved) {
      result.error = 'Failed to save to database';
      return result;
    }

    result.success = true;
    result.price = bestMatch.price;
    result.url = bestMatch.url;

    console.log(`   ✅ SAVED: $${bestMatch.price} - ${bestMatch.title?.substring(0, 50)}...`);
    console.log(`   🔗 URL: ${bestMatch.url}`);
    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Error: ${result.error}`);
    return result;
  }
}

async function runPriceUpdate() {
  console.log('🚀 Starting Amazon Price Update (Service Role)');
  console.log('=' .repeat(60));

  // Test database access first
  const dbAccess = await testDatabaseAccess();
  if (!dbAccess) {
    console.error('❌ Database access test failed');
    return;
  }

  // Check Amazon API availability
  const { amazonAPIService } = await import('../lib/amazon-api-service');
  if (!amazonAPIService.isAvailable()) {
    console.error('❌ Amazon API not available. Check credentials.');
    return;
  }

  console.log('✅ Amazon API is available');

  // Get games from database
  const games = await getAllGames();
  
  if (games.length === 0) {
    console.log('❌ No games found in database');
    return;
  }

  console.log(`🎯 Updating prices for ${games.length} games (overwriting existing Amazon prices)`);

  // Option to start from a specific index (useful for resuming)
  const startIndex = process.argv[2] ? parseInt(process.argv[2]) : 0;
  if (startIndex > 0) {
    console.log(`🔄 Resuming from game #${startIndex + 1}`);
  }
  console.log();

  const results: PriceUpdateResult[] = [];
  const startTime = Date.now();
  
  for (let i = startIndex; i < games.length; i++) {
    const game = games[i];
    const progress = `[${i + 1}/${games.length}]`;
    const percentage = Math.round(((i + 1) / games.length) * 100);
    
    // Time estimation
    const elapsed = Date.now() - startTime;
    const avgTimePerGame = elapsed / ((i - startIndex) + 1);
    const remaining = games.length - (i + 1);
    const estimatedTimeLeft = remaining * avgTimePerGame;
    const etaMinutes = Math.round(estimatedTimeLeft / 60000);
    
    console.log(`${progress} (${percentage}%) 🎲 ${game.title}`);
    if (game.bgg_id) {
      console.log(`   📊 BGG ID: ${game.bgg_id} | Game ID: ${game.id.substring(0, 8)}...`);
    }
    if (i > startIndex) {
      console.log(`   ⏱️ ETA: ~${etaMinutes} minutes remaining`);
    }
    
    const result = await updateGamePrice(game);
    results.push(result);

    // Checkpoint logging every 100 games
    if ((i + 1) % 100 === 0) {
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      console.log(`\n📊 CHECKPOINT [${i + 1}/${games.length}]: ${successful} successful, ${failed} failed`);
      console.log(`🔄 To resume from here, run: npx tsx scripts/update-prices-admin.ts ${i + 1}\n`);
    }

    // Rate limiting - wait 1.5 seconds between requests
    if (i < games.length - 1) {
      console.log(`   ⏳ Waiting 1.5 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    console.log();
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
    console.log();

    console.log('🎯 SUCCESSFUL UPDATES:');
    successful.forEach(result => {
      console.log(`   ${result.gameTitle}: $${result.price}`);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log('⚠️  FAILED UPDATES:');
    failed.forEach(result => {
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

// Check command line arguments - now just used for confirmation
const args = process.argv.slice(2);
const confirmRun = args.length === 0 || args[0].toLowerCase() === 'yes';

if (!confirmRun) {
  console.error('❌ To run the full price update, use:');
  console.log('  npx tsx scripts/update-prices-admin.ts');
  console.log('  npx tsx scripts/update-prices-admin.ts yes');
  console.log('\nThis will update ALL games in your database that don\'t have Amazon prices.');
  process.exit(1);
}

console.log('🎯 Will update prices for ALL games in database without Amazon prices');
console.log('⚠️  This will make API calls to Amazon and update your database');
console.log('💡 Rate limited to 1.5 seconds between requests');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  runPriceUpdate().catch(error => {
    console.error('❌ Price update failed:', error);
    process.exit(1);
  });
}, 3000);
