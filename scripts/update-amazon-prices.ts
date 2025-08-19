import { config } from 'dotenv';
import { createHash, createHmac } from 'crypto';
import { supabase } from '../lib/supabase';

// Load environment variables
config({ path: '.env.local' });

interface AmazonProduct {
  asin: string;
  title: string;
  price?: number;
  currency?: string;
  url: string;
  imageUrl?: string;
  availability?: string;
  prime?: boolean;
  rating?: number;
  reviewCount?: number;
}

interface Game {
  id: string;
  title: string;
  bgg_id?: number;
  image_url?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createAWSV4Headers(
  accessKey: string,
  secretKey: string,
  host: string,
  path: string,
  payload: string,
  service: string = 'ProductAdvertisingAPI',
  region: string = 'us-east-1'
): Record<string, string> {
  const date = new Date();
  const amzDate = date.toISOString().replace(/[:\-]|\.\d{3}/g, '');
  const dateStamp = amzDate.substr(0, 8);

  // Create headers (must include Content-Encoding for Amazon PA API)
  const headers: Record<string, string> = {
    'Host': host,
    'Content-Type': 'application/json; charset=utf-8',
    'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems',
    'Content-Encoding': 'amz-1.0',
    'X-Amz-Date': amzDate
  };

  // Create canonical request
  const signedHeaders = Object.keys(headers).map(k => k.toLowerCase()).sort().join(';');
  const canonicalHeaders = Object.keys(headers)
    .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n') + '\n';

  const payloadHash = createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    'POST',
    path,
    '', // query string
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n');

  // Calculate signature
  const getSignatureKey = (key: string, dateStamp: string, regionName: string, serviceName: string): Buffer => {
    const kDate = createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(regionName).digest();
    const kService = createHmac('sha256', kRegion).update(serviceName).digest();
    const kSigning = createHmac('sha256', kService).update('aws4_request').digest();
    return kSigning;
  };

  const signingKey = getSignatureKey(secretKey, dateStamp, region, service);
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  // Add authorization header
  headers['Authorization'] = `${algorithm} Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

async function searchAmazonForGame(game: Game): Promise<AmazonProduct | null> {
  const accessKey = process.env.AMAZON_ACCESS_KEY;
  const secretKey = process.env.AMAZON_SECRET_KEY;
  const partnerTag = process.env.AMAZON_PARTNER_TAG;

  if (!accessKey || !secretKey || !partnerTag) {
    throw new Error('Missing Amazon credentials');
  }

  const host = 'webservices.amazon.com';
  const path = '/paapi5/searchitems';
  const url = `https://${host}${path}`;

  // Create search payload - try the game title + "board game"
  const payload = JSON.stringify({
    Keywords: `${game.title} board game`,
    SearchIndex: 'ToysAndGames',
    PartnerTag: partnerTag,
    PartnerType: 'Associates',
    ItemCount: 3, // Get top 3 results to find best match
    Resources: [
      'Images.Primary.Medium',
      'ItemInfo.Title',
      'ItemInfo.Features',
      'Offers.Listings.Price',
      'Offers.Listings.Availability.Type',
      'Offers.Listings.DeliveryInfo.IsPrimeEligible',
      'Offers.Summaries.LowestPrice',
      'CustomerReviews.StarRating',
      'CustomerReviews.Count'
    ]
  });

  const headers = createAWSV4Headers(accessKey, secretKey, host, path, payload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload
    });

    if (response.status === 429) {
      console.log(`⏰ Rate limited for ${game.title}, will retry later`);
      return null;
    }

    if (!response.ok) {
      console.log(`❌ Amazon API error for ${game.title}: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    
    if (!data.SearchResult?.Items?.length) {
      console.log(`⚠️ No Amazon results found for ${game.title}`);
      return null;
    }

    // Find the best matching product
    const bestMatch = findBestMatch(game.title, data.SearchResult.Items);
    return bestMatch;

  } catch (error) {
    console.error(`❌ Error searching Amazon for ${game.title}:`, error);
    return null;
  }
}

function findBestMatch(gameTitle: string, items: any[]): AmazonProduct | null {
  const products = items.map(item => parseAmazonItem(item)).filter(Boolean) as AmazonProduct[];
  
  if (!products.length) return null;

  // Score each product for relevance
  const scored = products.map(product => {
    let score = 0;
    
    // Title similarity (basic keyword matching)
    const gameWords = gameTitle.toLowerCase().split(/\s+/);
    const productWords = product.title.toLowerCase().split(/\s+/);
    
    gameWords.forEach(word => {
      if (word.length > 2) {
        if (productWords.some(pw => pw.includes(word))) {
          score += 10;
        }
        // Exact match bonus
        if (productWords.includes(word)) {
          score += 5;
        }
      }
    });

    // Prefer items with prices
    if (product.price && product.price > 0) score += 20;
    
    // Prefer Prime eligible items
    if (product.prime) score += 5;
    
    // Prefer items with good reviews
    if (product.rating && product.rating >= 4) score += 5;
    
    // Avoid very cheap items (likely accessories)
    if (product.price && product.price < 15) score -= 10;
    
    // Avoid very expensive items (likely collectibles)
    if (product.price && product.price > 200) score -= 5;

    return { product, score };
  });

  // Return the highest scoring product with a price
  scored.sort((a, b) => b.score - a.score);
  const bestMatch = scored.find(item => item.product.price && item.product.price > 0);
  
  return bestMatch?.product || null;
}

function parseAmazonItem(item: any): AmazonProduct | null {
  try {
    if (!item.ASIN || !item.ItemInfo?.Title?.DisplayValue) {
      return null;
    }

    const partnerTag = process.env.AMAZON_PARTNER_TAG;
    const product: AmazonProduct = {
      asin: item.ASIN,
      title: item.ItemInfo.Title.DisplayValue,
      url: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}?tag=${partnerTag}`
    };

    // Extract price information
    if (item.Offers?.Listings?.[0]?.Price) {
      product.price = item.Offers.Listings[0].Price.Amount;
      product.currency = item.Offers.Listings[0].Price.Currency;
    } else if (item.Offers?.Summaries?.LowestPrice) {
      product.price = item.Offers.Summaries.LowestPrice.Amount;
      product.currency = item.Offers.Summaries.LowestPrice.Currency;
    }

    // Extract availability
    if (item.Offers?.Listings?.[0]?.Availability?.Type) {
      product.availability = item.Offers.Listings[0].Availability.Type;
    }

    // Extract Prime eligibility
    if (item.Offers?.Listings?.[0]?.DeliveryInfo?.IsPrimeEligible) {
      product.prime = item.Offers.Listings[0].DeliveryInfo.IsPrimeEligible;
    }

    // Extract image
    if (item.Images?.Primary?.Medium?.URL) {
      product.imageUrl = item.Images.Primary.Medium.URL;
    }

    // Extract reviews
    if (item.CustomerReviews?.StarRating?.Value) {
      product.rating = parseFloat(item.CustomerReviews.StarRating.Value);
    }
    
    if (item.CustomerReviews?.Count) {
      product.reviewCount = item.CustomerReviews.Count;
    }

    return product;

  } catch (error) {
    console.error('❌ Error parsing Amazon item:', error);
    return null;
  }
}

async function saveGamePrice(gameId: string, product: AmazonProduct): Promise<boolean> {
  if (!supabase || !product.price) {
    return false;
  }

  try {
    const priceData = {
      game_id: gameId,
      store_name: 'Amazon',
      price: product.price,
      currency: product.currency || 'USD',
      url: product.url,
      last_updated: new Date().toISOString(),
      // Store additional metadata in a JSON field if your schema supports it
      metadata: {
        asin: product.asin,
        prime: product.prime,
        rating: product.rating,
        reviewCount: product.reviewCount,
        availability: product.availability,
        imageUrl: product.imageUrl
      }
    };

    const { error } = await supabase
      .from('game_prices')
      .upsert([priceData], { onConflict: 'game_id,store_name' });

    if (error) {
      console.error('❌ Database save error:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Database save error:', error);
    return false;
  }
}

async function getTop200Games(): Promise<Game[]> {
  if (!supabase) {
    throw new Error('Supabase not available');
  }

  try {
    // Get top 200 games ordered by BGG rank or creation date
    const { data, error } = await supabase
      .from('games')
      .select('id, title, bgg_id, image_url')
      .order('bgg_id', { ascending: true, nullsFirst: false })
      .limit(200);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('❌ Error fetching games:', error);
    throw error;
  }
}

async function updateGamePrices() {
  console.log('🎲 Starting Amazon Price Update for Top 200 Games');
  console.log('⚠️ Rate Limited: 1 request every 3 seconds to respect Amazon API limits');
  console.log('📊 This will take approximately 10+ minutes\n');

  try {
    // Check credentials
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    const partnerTag = process.env.AMAZON_PARTNER_TAG;

    if (!accessKey || !secretKey || !partnerTag) {
      throw new Error('Missing Amazon API credentials in environment variables');
    }

    console.log(`🔑 Credentials verified:
  Access Key: ${accessKey.substring(0, 8)}...
  Secret Key: ${secretKey.substring(0, 8)}...
  Partner Tag: ${partnerTag}`);

    // Get top 200 games
    console.log('\n📚 Fetching top 200 games from database...');
    const games = await getTop200Games();
    console.log(`✅ Found ${games.length} games to process\n`);

    if (games.length === 0) {
      console.log('⚠️ No games found in database. Make sure games have been imported first.');
      return;
    }

    // Process games with rate limiting
    let successful = 0;
    let failed = 0;
    let rateLimited = 0;

    for (const [index, game] of games.entries()) {
      const progress = ((index + 1) / games.length * 100).toFixed(1);
      console.log(`\n🎯 [${index + 1}/${games.length}] (${progress}%) Processing: ${game.title}`);

      try {
        // Search Amazon for the game
        const product = await searchAmazonForGame(game);

        if (product) {
          // Save to database
          const saved = await saveGamePrice(game.id, product);
          
          if (saved) {
            console.log(`✅ Success: $${product.price} - ${product.title}`);
            if (product.prime) console.log('   🚚 Prime eligible');
            if (product.rating) console.log(`   ⭐ ${product.rating}/5 (${product.reviewCount || 0} reviews)`);
            successful++;
          } else {
            console.log(`❌ Failed to save price data`);
            failed++;
          }
        } else {
          console.log(`⚠️ No product found or rate limited`);
          rateLimited++;
        }

        // Rate limiting: wait 3 seconds between requests
        if (index < games.length - 1) {
          console.log('⏳ Waiting 3 seconds before next request...');
          await sleep(3000);
        }

      } catch (error) {
        console.error(`❌ Error processing ${game.title}:`, error);
        failed++;
        
        // Wait even on error to prevent rate limiting
        if (index < games.length - 1) {
          await sleep(3000);
        }
      }
    }

    // Final summary
    console.log(`\n🏁 Amazon Price Update Complete!`);
    console.log(`📊 Results:
  ✅ Successful: ${successful}
  ❌ Failed: ${failed}
  ⏰ Rate Limited/Not Found: ${rateLimited}
  📦 Total Processed: ${games.length}`);

    console.log(`\n💡 To view updated prices, query the game_prices table:
  SELECT * FROM game_prices WHERE store_name = 'Amazon' ORDER BY last_updated DESC;`);

  } catch (error) {
    console.error('❌ Fatal error during price update:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Received interrupt signal, shutting down gracefully...');
  process.exit(0);
});

// Run the script
if (require.main === module) {
  updateGamePrices().catch(console.error);
}

export { updateGamePrices, searchAmazonForGame };
