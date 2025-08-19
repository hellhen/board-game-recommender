/* eslint-disable @typescript-eslint/no-explicit-any */

import { supabase } from './supabase';

export interface BGGPriceData {
  storeName: string;
  price: number;
  currency: string;
  url: string;
  availability?: string;
}

export interface BGGPriceResult {
  success: boolean;
  gameTitle?: string;
  prices?: BGGPriceData[];
  error?: string;
}

export class BGGPriceService {
  private isEnabled: boolean = true;

  constructor() {
    console.log('✅ BGG Price Service initialized (URL-only mode)');
  }

  /**
   * Generate BGG marketplace URL from BGG ID
   */
  generateBGGMarketplaceURL(bggId: number): string {
    return `https://boardgamegeek.com/boardgame/${bggId}#buyacopy`;
  }

  /**
   * Create BGG price result with marketplace link
   */
  createBGGResult(bggId: number, gameTitle: string): BGGPriceResult {
    const url = this.generateBGGMarketplaceURL(bggId);
    
    console.log(`🔗 Generated BGG marketplace link for "${gameTitle}": ${url}`);
    
    return {
      success: true,
      gameTitle,
      prices: [{
        storeName: 'BoardGameGeek Marketplace',
        price: 0, // Price not available, but link provides access to multiple retailers
        currency: 'USD',
        url,
        availability: 'Available'
      }]
    };
  }

  /**
   * Get BGG price info by looking up game in our database
   */
  async getGamePrices(gameTitle: string): Promise<BGGPriceResult> {
    if (!this.isEnabled) {
      return { success: false, error: 'BGG service disabled' };
    }

    try {
      console.log(`🔍 Looking up BGG info for: ${gameTitle}`);

      // First try to find the game in our database
      if (supabase) {
        const { data, error } = await supabase
          .from('games')
          .select('name, bgg_id')
          .ilike('name', `%${gameTitle}%`)
          .limit(1)
          .single();

        if (!error && data && data.bgg_id) {
          console.log(`✅ Found game in database: ${data.name} (BGG ID: ${data.bgg_id})`);
          return this.createBGGResult(data.bgg_id, data.name);
        }
      }

      // If not found in database, try the BGG XML API for the ID
      const bggId = await this.searchGameId(gameTitle);
      if (bggId) {
        console.log(`✅ Found BGG ID ${bggId} via API search`);
        return this.createBGGResult(bggId, gameTitle);
      }

      console.log(`❌ Could not find BGG info for: ${gameTitle}`);
      return {
        success: false,
        error: 'Game not found on BoardGameGeek'
      };

    } catch (error) {
      console.error('BGG service error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Search for game ID using BGG XML API (lightweight)
   */
  private async searchGameId(gameTitle: string): Promise<number | null> {
    try {
      console.log(`🔍 Searching BGG API for: ${gameTitle}`);
      
      // Search BGG XML API
      const searchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameTitle)}&type=boardgame&exact=1`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'BoardGameSommelier/1.0 (Educational Project)'
        }
      });

      if (!response.ok) {
        return null;
      }

      const xmlText = await response.text();
      const gameIdMatch = xmlText.match(/<item[^>]*id="(\d+)"[^>]*>/);
      
      if (gameIdMatch) {
        const gameId = parseInt(gameIdMatch[1]);
        console.log(`✅ Found BGG ID ${gameId} for "${gameTitle}"`);
        return gameId;
      }

      // Try less exact search if exact fails
      if (searchUrl.includes('exact=1')) {
        console.log(`🔍 Exact search failed, trying broader search for: ${gameTitle}`);
        const broadSearchUrl = `https://boardgamegeek.com/xmlapi2/search?query=${encodeURIComponent(gameTitle)}&type=boardgame`;
        
        const broadResponse = await fetch(broadSearchUrl, {
          headers: {
            'User-Agent': 'BoardGameSommelier/1.0 (Educational Project)'
          }
        });

        if (broadResponse.ok) {
          const broadXmlText = await broadResponse.text();
          const broadGameIdMatch = broadXmlText.match(/<item[^>]*id="(\d+)"[^>]*>/);
          if (broadGameIdMatch) {
            const gameId = parseInt(broadGameIdMatch[1]);
            console.log(`✅ Found BGG ID ${gameId} for "${gameTitle}" (broad search)`);
            return gameId;
          }
        }
      }

      console.log(`⚠️ No BGG ID found for: ${gameTitle}`);
      return null;

    } catch (error) {
      console.error('BGG search error:', error);
      return null;
    }
  }
}
