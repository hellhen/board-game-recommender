import { supabase } from './supabase';
import { SmartPriceService, PriceData } from './smart-price-service';

// Legacy interface for backward compatibility
export interface GamePrice {
  id?: number;
  game_id: number;
  store_name: string;
  price: number;
  currency: string;
  url: string;
  last_updated: string;
}

export interface GameWithPrices {
  id: string;
  title: string;
  prices: GamePrice[];
  bestPrice?: {
    store: string;
    price: number;
    url: string;
    affiliate_url?: string;
  };
}

export class PriceService {
  private smartPriceService: SmartPriceService;

  constructor() {
    this.smartPriceService = new SmartPriceService();
  }

  /**
   * Get current prices for a game from database
   */
  async getGamePrices(gameId: string): Promise<GamePrice[]> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase not available');
        return [];
      }

      const { data, error } = await supabase
        .from('game_prices')
        .select('*')
        .eq('game_id', gameId)
        .order('price', { ascending: true });

      if (error) {
        console.error(`❌ Failed to fetch prices for game ${gameId}:`, error);
        return [];
      }

      return data as GamePrice[] || [];
    } catch (error) {
      console.error(`❌ Database error fetching prices for ${gameId}:`, error);
      return [];
    }
  }

  /**
   * Get prices for multiple games at once
   */
  async getBulkGamePrices(gameIds: string[]): Promise<Map<string, GamePrice[]>> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase not available');
        return new Map();
      }

      const { data, error } = await supabase
        .from('game_prices')
        .select('*')
        .in('game_id', gameIds)
        .order('price', { ascending: true });

      if (error) {
        console.error(`❌ Failed to fetch bulk prices:`, error);
        return new Map();
      }

      // Group by game_id
      const priceMap = new Map<string, GamePrice[]>();
      for (const price of data || []) {
        const gameId = price.game_id.toString();
        if (!priceMap.has(gameId)) {
          priceMap.set(gameId, []);
        }
        priceMap.get(gameId)!.push(price as GamePrice);
      }

      return priceMap;
    } catch (error) {
      console.error(`❌ Database error fetching bulk prices:`, error);
      return new Map();
    }
  }

  /**
   * Update prices for a specific game using the smart price service
   */
  async updateGamePrices(gameId: string, gameTitle: string, forceUpdate = false): Promise<boolean> {
    console.log(`🔄 Updating prices for: ${gameTitle} (${gameId}) using Smart Price Service`);
    
    try {
      const priceData = await this.smartPriceService.getGamePrice(gameId, gameTitle);
      
      if (priceData.source === 'api' || forceUpdate) {
        console.log(`✅ Updated price for ${gameTitle}: ${priceData.price ? `$${priceData.price}` : 'fallback'}`);
        return true;
      } else if (priceData.source === 'cache') {
        console.log(`⏭️ Using cached price for ${gameTitle}`);
        return true;
      } else {
        console.log(`⚠️ Using fallback for ${gameTitle}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error updating price for ${gameTitle}:`, error);
      return false;
    }
  }

  /**
   * Update prices for multiple games in batch
   */
  async updateBulkGamePrices(games: Array<{ id: string; title: string }>, maxConcurrent = 5): Promise<number> {
    console.log(`🔄 Starting bulk price update for ${games.length} games using Smart Price Service...`);
    
    try {
      const results = await this.smartPriceService.getGamePrices(games);
      const successCount = results.filter(result => 
        result.source === 'api' || result.source === 'cache'
      ).length;

      console.log(`✅ Bulk update complete: ${successCount}/${games.length} games processed`);
      return successCount;
    } catch (error) {
      console.error(`❌ Error in bulk price update:`, error);
      return 0;
    }
  }

  /**
   * Get games with their current prices, including best price calculation
   */
  async getGamesWithPrices(gameIds: string[]): Promise<GameWithPrices[]> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase not available, using smart price service only');
        return [];
      }

      // Get game basic info
      const { data: games, error: gamesError } = await supabase
        .from('games')
        .select('id, title')
        .in('id', gameIds);

      if (gamesError) {
        console.error('❌ Failed to fetch games:', gamesError);
        return [];
      }

      // Get prices using smart price service for each game
      const gamesWithPrices: GameWithPrices[] = [];
      
      for (const game of games || []) {
        const priceData = await this.smartPriceService.getGamePrice(game.id.toString(), game.title);
        const cachedPrices = await this.getGamePrices(game.id.toString());
        
        let bestPrice: GameWithPrices['bestPrice'] = undefined;
        
        if (priceData.price) {
          bestPrice = {
            store: priceData.storeName,
            price: priceData.price,
            url: priceData.url || '',
            affiliate_url: priceData.url
          };
        } else if (cachedPrices.length > 0) {
          const cheapest = cachedPrices[0]; // Already sorted by price
          bestPrice = {
            store: cheapest.store_name,
            price: cheapest.price,
            url: cheapest.url,
            affiliate_url: cheapest.url
          };
        }

        gamesWithPrices.push({
          id: game.id.toString(),
          title: game.title,
          prices: cachedPrices,
          bestPrice
        });
      }

      return gamesWithPrices;
    } catch (error) {
      console.error('❌ Error in getGamesWithPrices:', error);
      return [];
    }
  }

  /**
   * Calculate the best price from available options
   */
  private calculateBestPrice(prices: GamePrice[]): GameWithPrices['bestPrice'] {
    if (!prices.length) return undefined;

    // Find cheapest price
    const cheapest = prices.reduce((min, current) => 
      current.price < min.price ? current : min
    );

    return {
      store: cheapest.store_name,
      price: cheapest.price,
      url: cheapest.url,
      affiliate_url: cheapest.url
    };
  }

  /**
   * Get price statistics using smart price service
   */
  async getPriceStatistics(): Promise<{
    totalGamesWithPrices: number;
    averagePrice: number;
    pricesByStore: Record<string, { count: number; averagePrice: number }>;
    lastUpdated: Date;
  }> {
    try {
      const stats = await this.smartPriceService.getPriceStatistics();
      
      return {
        totalGamesWithPrices: stats.totalPrices,
        averagePrice: stats.avgPrice,
        pricesByStore: {
          'Amazon': { 
            count: stats.totalPrices, 
            averagePrice: stats.avgPrice 
          }
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Error getting price statistics:', error);
      return {
        totalGamesWithPrices: 0,
        averagePrice: 0,
        pricesByStore: {},
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Clean up old price data
   */
  async cleanupOldPrices(olderThanDays = 30): Promise<number> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase not available');
        return 0;
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const { count, error } = await supabase
        .from('game_prices')
        .delete()
        .lt('last_updated', cutoffDate.toISOString());

      if (error) {
        console.error('❌ Failed to cleanup old prices:', error);
        return 0;
      }

      console.log(`🧹 Cleaned up ${count || 0} old price records`);
      return count || 0;
    } catch (error) {
      console.error('❌ Error in price cleanup:', error);
      return 0;
    }
  }

  /**
   * Find games that need price updates (no recent prices)
   */
  async findGamesNeedingPriceUpdates(maxAge = 24): Promise<Array<{ id: string; title: string }>> {
    try {
      if (!supabase) {
        console.warn('⚠️ Supabase not available');
        return [];
      }

      // Get all games
      const { data: allGames, error: gamesError } = await supabase
        .from('games')
        .select('id, title')
        .limit(100); // Limit for performance

      if (gamesError) {
        throw gamesError;
      }

      // Get games with recent prices
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - maxAge);

      const { data: recentPrices, error: pricesError } = await supabase
        .from('game_prices')
        .select('game_id')
        .gt('last_updated', cutoffDate.toISOString());

      if (pricesError) {
        throw pricesError;
      }

      const gamesWithRecentPrices = new Set((recentPrices || []).map(p => p.game_id.toString()));
      
      // Return games that don't have recent prices
      return (allGames || [])
        .filter(game => !gamesWithRecentPrices.has(game.id.toString()))
        .map(game => ({ id: game.id.toString(), title: game.title }));

    } catch (error) {
      console.error('❌ Error finding games needing updates:', error);
      return [];
    }
  }
}

// Export singleton instance
export const priceService = new PriceService();
