/* eslint-disable @typescript-eslint/no-explicit-any */

import AmazonAPIServiceV3 from './amazon-api-service-v3';
import { BGGPriceService } from './bgg-price-service';
import { supabase } from './supabase';

export interface PriceData {
  gameId: string;
  title: string;
  price?: number;
  currency?: string;
  url?: string;
  storeName: string;
  lastUpdated: string;
  source: 'cache' | 'api' | 'fallback';
}

export interface BulkPriceUpdate {
  total: number;
  updated: number;
  failed: number;
  errors: string[];
}

export class SmartPriceService {
  private amazonAPI: AmazonAPIServiceV3;
  private bggPriceService: BGGPriceService;
  private readonly CACHE_DURATION_HOURS = 72; // 3 days
  private readonly POPULAR_GAME_THRESHOLD = 10; // Games requested 10+ times

  constructor() {
    this.amazonAPI = new AmazonAPIServiceV3();
    this.bggPriceService = new BGGPriceService();
  }

  /**
   * Get price for a game with smart caching strategy
   * 1. Try cache first (instant)
   * 2. If stale/missing, try API (for popular games)
   * 3. Fallback to "Check Amazon" link
   */
  async getGamePrice(gameId: string, gameTitle: string): Promise<PriceData> {
    try {
      // Try cache first
      const cachedPrice = await this.getCachedPrice(gameId);
      
      if (cachedPrice && !this.isPriceStale(cachedPrice.lastUpdated)) {
        // Fresh cache hit - return immediately
        return {
          ...cachedPrice,
          source: 'cache'
        };
      }

      // Cache miss or stale - try APIs for real-time data
      console.log(`🔄 Cache miss/stale for ${gameTitle}, fetching from APIs...`);
      
      // Try BGG first (comprehensive retail data while Amazon API warms up)
      const bggPrice = await this.getBGGPrice(gameId, gameTitle);
      if (bggPrice) {
        return bggPrice;
      }

      // Try Amazon API as backup
      const apiSuccess = await this.amazonAPI.updateGamePrice(gameId, gameTitle);
      
      if (apiSuccess) {
        // API success - return fresh data
        const freshPrice = await this.getCachedPrice(gameId);
        if (freshPrice) {
          return {
            ...freshPrice,
            source: 'api'
          };
        }
      }

      // API failed - return stale cache if available, or fallback
      if (cachedPrice) {
        console.log(`⚠️ API failed, using stale cache for ${gameTitle}`);
        return {
          ...cachedPrice,
          source: 'cache'
        };
      }

      // Complete fallback
      return this.createFallbackPrice(gameId, gameTitle);

    } catch (error) {
      console.error('❌ Error getting game price:', error);
      return this.createFallbackPrice(gameId, gameTitle);
    }
  }

  /**
   * Get prices for multiple games efficiently
   */
  async getGamePrices(games: Array<{ id: string; title: string }>): Promise<PriceData[]> {
    const promises = games.map(game => 
      this.getGamePrice(game.id, game.title)
    );

    return await Promise.all(promises);
  }

  /**
   * Get cached price from database
   */
  private async getCachedPrice(gameId: string): Promise<PriceData | null> {
    if (!supabase) {
      console.warn('⚠️ Supabase not available');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('game_prices')
        .select('*')
        .eq('game_id', parseInt(gameId))
        .eq('store_name', 'Amazon')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        gameId,
        title: '', // Will be filled by caller
        price: data.price,
        currency: data.currency || 'USD',
        url: data.url,
        storeName: data.store_name,
        lastUpdated: data.last_updated,
        source: 'cache'
      };

    } catch (error) {
      console.error('❌ Error fetching cached price:', error);
      return null;
    }
  }

  /**
   * Check if cached price is stale
   */
  private isPriceStale(lastUpdated: string): boolean {
    const updateTime = new Date(lastUpdated).getTime();
    const now = Date.now();
    const staleThreshold = this.CACHE_DURATION_HOURS * 60 * 60 * 1000;

    return (now - updateTime) > staleThreshold;
  }

  /**
   * Create fallback price data when all else fails
   */
  private createFallbackPrice(gameId: string, gameTitle: string): PriceData {
    // Create Amazon search URL as fallback
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(gameTitle + ' board game')}&tag=${process.env.AMAZON_PARTNER_TAG || 'boardgamesommelier-20'}`;

    return {
      gameId,
      title: gameTitle,
      price: undefined,
      currency: 'USD',
      url: searchUrl,
      storeName: 'Amazon',
      lastUpdated: new Date().toISOString(),
      source: 'fallback'
    };
  }

  /**
   * Get price from BGG scraping
   */
  private async getBGGPrice(gameId: string, gameTitle: string): Promise<PriceData | null> {
    try {
      console.log(`🎲 Trying BGG prices for: ${gameTitle}`);
      
      const bggResult = await this.bggPriceService.getGamePrices(gameTitle);
      
      if (bggResult.success && bggResult.prices && bggResult.prices.length > 0) {
        // Use the best (lowest) price, but handle $0 fallback prices
        const validPrices = bggResult.prices.filter(p => p.price > 0);
        const priceToUse = validPrices.length > 0 
          ? validPrices.reduce((min, current) => current.price < min.price ? current : min)
          : bggResult.prices[0]; // Use the BGG link even if no price

        // Save to cache for future requests
        const priceData: PriceData = {
          gameId,
          title: gameTitle,
          price: priceToUse.price,
          currency: priceToUse.currency,
          url: priceToUse.url,
          storeName: priceToUse.storeName,
          lastUpdated: new Date().toISOString(),
          source: 'api'
        };

        // Save to database
        await this.saveBGGPriceToDatabase(gameId, priceToUse);
        console.log(`✅ BGG price found: ${priceToUse.currency} ${priceToUse.price} (${priceToUse.storeName})`);
        return priceData;
      }

      console.log(`⚠️ No BGG prices found for: ${gameTitle}`);
      return null;

    } catch (error) {
      console.error(`❌ BGG price lookup failed for ${gameTitle}:`, error);
      return null;
    }
  }

  /**
   * Save BGG price to database
   */
  private async saveBGGPriceToDatabase(gameId: string, priceData: any): Promise<void> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase not available, skipping BGG price save');
        return;
      }

      const { error } = await supabase
        .from('game_prices')
        .upsert({
          game_id: parseInt(gameId),
          store_name: priceData.storeName,
          price: priceData.price,
          currency: priceData.currency,
          url: priceData.url,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'game_id,store_name'
        });

      if (error) {
        console.error('❌ Database error saving BGG price:', error);
      }
    } catch (error) {
      console.error('❌ Error saving BGG price to database:', error);
    }
  }

  /**
   * Update popular games in bulk (for cron jobs)
   */
  async updatePopularGamesPrices(limit: number = 50): Promise<BulkPriceUpdate> {
    if (!supabase) {
      console.warn('⚠️ Supabase not available, cannot update prices');
      return {
        total: 0,
        updated: 0, 
        failed: 0,
        errors: ['Supabase not available']
      };
    }

    console.log(`🔄 Starting bulk update of ${limit} popular games...`);

    const result: BulkPriceUpdate = {
      total: 0,
      updated: 0,
      failed: 0,
      errors: []
    };

    try {
      // Get popular games (those with recent price requests or high ranks)
      const { data: games, error } = await supabase
        .from('games')
        .select('id, name')
        .not('rank', 'is', null)
        .lte('rank', 1000) // Top 1000 games
        .order('rank')
        .limit(limit);

      if (error || !games) {
        throw new Error(`Failed to fetch popular games: ${error?.message}`);
      }

      result.total = games.length;
      console.log(`📊 Found ${games.length} popular games to update`);

      // Update prices with rate limiting
      for (const game of games) {
        try {
          console.log(`🔄 Updating ${game.name}...`);
          
          const success = await this.amazonAPI.updateGamePrice(
            game.id.toString(), 
            game.name
          );

          if (success) {
            result.updated++;
            console.log(`✅ Updated ${game.name}`);
          } else {
            result.failed++;
            result.errors.push(`Failed to update ${game.name}: No price found`);
          }

          // Small delay between updates to respect rate limits
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          result.failed++;
          const errorMsg = `Failed to update ${game.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      console.log(`🎉 Bulk update complete: ${result.updated} updated, ${result.failed} failed`);
      return result;

    } catch (error) {
      console.error('❌ Bulk update failed:', error);
      throw error;
    }
  }

  /**
   * Get price statistics
   */
  async getPriceStatistics(): Promise<{
    totalPrices: number;
    freshPrices: number;
    stalePrices: number;
    avgPrice: number;
  }> {
    if (!supabase) {
      console.warn('⚠️ Supabase not available, returning empty statistics');
      return { totalPrices: 0, freshPrices: 0, stalePrices: 0, avgPrice: 0 };
    }

    const { data, error } = await supabase
      .from('game_prices')
      .select('price, last_updated')
      .eq('store_name', 'Amazon')
      .not('price', 'is', null);

    if (error || !data) {
      return { totalPrices: 0, freshPrices: 0, stalePrices: 0, avgPrice: 0 };
    }

    const now = Date.now();
    const staleThreshold = this.CACHE_DURATION_HOURS * 60 * 60 * 1000;

    let freshCount = 0;
    let staleCount = 0;
    let totalPrice = 0;

    data.forEach(row => {
      const updateTime = new Date(row.last_updated).getTime();
      
      if ((now - updateTime) <= staleThreshold) {
        freshCount++;
      } else {
        staleCount++;
      }

      totalPrice += row.price || 0;
    });

    return {
      totalPrices: data.length,
      freshPrices: freshCount,
      stalePrices: staleCount,
      avgPrice: data.length > 0 ? totalPrice / data.length : 0
    };
  }

  /**
   * Force refresh a specific game's price
   */
  async forceRefreshPrice(gameId: string, gameTitle: string): Promise<PriceData> {
    console.log(`🔄 Force refreshing price for ${gameTitle}...`);
    
    const success = await this.amazonAPI.updateGamePrice(gameId, gameTitle);
    
    if (success) {
      const freshPrice = await this.getCachedPrice(gameId);
      if (freshPrice) {
        return {
          ...freshPrice,
          source: 'api'
        };
      }
    }

    return this.createFallbackPrice(gameId, gameTitle);
  }
}

export default SmartPriceService;
