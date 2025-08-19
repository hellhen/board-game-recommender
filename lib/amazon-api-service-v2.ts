/* eslint-disable @typescript-eslint/no-explicit-any */

// Server-side only Amazon API service to avoid Next.js bundling issues
import { supabase } from './supabase';

export interface AmazonSearchResult {
  success: boolean;
  items?: AmazonProduct[];
  error?: string;
  totalResults?: number;
}

export interface AmazonProduct {
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

export class AmazonAPIServiceV2 {
  private client: any;
  private partnerTag: string;
  private partnerType: string = 'Associates';
  private marketplace: string = 'www.amazon.com';
  private lastRequestTime: number = 0;
  private minDelayMs: number = 1200; // 1.2 seconds between requests (conservative)
  private isInitialized: boolean = false;

  constructor() {
    // Initialize the Amazon PA API client
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    this.partnerTag = process.env.AMAZON_PARTNER_TAG || '';

    if (!accessKey || !secretKey || !this.partnerTag) {
      console.warn('⚠️ Amazon API credentials not configured. API will not be available.');
      return;
    }

    // Only initialize on server side
    if (typeof window === 'undefined') {
      this.initializeClient(accessKey, secretKey);
    }
  }

  /**
   * Initialize the Amazon API client (server-side only)
   */
  private initializeClient(accessKey: string, secretKey: string) {
    try {
      // Use require instead of import to avoid Next.js bundling
      const paapi = require('paapi5-nodejs-sdk');
      
      this.client = paapi.ApiClient.instance;
      this.client.accessKey = accessKey;
      this.client.secretKey = secretKey;
      this.client.host = 'webservices.amazon.com';
      this.client.region = 'us-east-1';
      
      this.isInitialized = true;
      console.log('✅ Amazon Product Advertising API V2 initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Amazon API:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Ensure proper rate limiting between requests
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minDelayMs) {
      const delayNeeded = this.minDelayMs - timeSinceLastRequest;
      console.log(`⏱️  Rate limiting: waiting ${delayNeeded}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayNeeded));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Search for board games using the SearchItems operation with proper rate limiting
   */
  async searchBoardGames(gameTitle: string, options: {
    maxResults?: number;
    sortBy?: 'Relevance' | 'Price:LowToHigh' | 'Price:HighToLow' | 'AvgCustomerReviews';
    minReviewsRating?: number;
  } = {}): Promise<AmazonSearchResult> {
    if (!this.isInitialized || !this.client) {
      return { success: false, error: 'Amazon API not initialized' };
    }

    try {
      // Enforce rate limiting
      await this.enforceRateLimit();

      console.log(`🔍 Searching Amazon for: ${gameTitle}`);

      // Use require to avoid bundling issues
      const paapi = require('paapi5-nodejs-sdk');

      // Create the search request with conservative parameters
      const searchItemsRequest = new paapi.SearchItemsRequest();
      
      // Required parameters
      searchItemsRequest.PartnerTag = this.partnerTag;
      searchItemsRequest.PartnerType = this.partnerType;  
      searchItemsRequest.Marketplace = this.marketplace;
      
      // Search parameters - be conservative
      searchItemsRequest.Keywords = gameTitle; // Remove "board game" to avoid over-constraining
      searchItemsRequest.SearchIndex = 'ToysAndGames';
      searchItemsRequest.ItemCount = Math.min(options.maxResults || 5, 5); // Limit to 5 results max
      
      // Only set sort if specified and not default
      if (options.sortBy && options.sortBy !== 'Relevance') {
        searchItemsRequest.SortBy = options.sortBy;
      }
      
      // Optional filters
      if (options.minReviewsRating) {
        searchItemsRequest.MinReviewsRating = options.minReviewsRating;
      }
      
      // Request minimal resources to avoid timeouts
      searchItemsRequest.Resources = [
        'ItemInfo.Title',
        'Offers.Summaries.LowestPrice',
        'Images.Primary.Medium'
      ];

      // Execute the search with promise wrapper
      const searchItemsApi = new paapi.DefaultApi();
      
      return new Promise((resolve) => {
        searchItemsApi.searchItems(searchItemsRequest, (error: any, data: any) => {
          if (error) {
            console.error('❌ Amazon API search error:', error.message || error);
            
            // Enhanced error handling
            if (error.status === 429) {
              resolve({ 
                success: false, 
                error: 'Rate limit exceeded. Please wait before making another request.'
              });
            } else if (error.status === 400) {
              resolve({ 
                success: false, 
                error: 'Invalid request parameters.'
              });
            } else {
              resolve({ 
                success: false, 
                error: this.formatApiError(error)
              });
            }
            return;
          }

          // Process successful response
          try {
            const items = this.processSearchResponse(data);
            console.log(`✅ Found ${items.length} products for "${gameTitle}"`);
            
            resolve({
              success: true,
              items,
              totalResults: items.length
            });
          } catch (processError) {
            console.error('❌ Error processing API response:', processError);
            resolve({
              success: false,
              error: 'Failed to process Amazon API response'
            });
          }
        });
      });

    } catch (error) {
      console.error('❌ Amazon API search failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process Amazon API search response
   */
  private processSearchResponse(data: any): AmazonProduct[] {
    if (!data || !data.SearchResult || !data.SearchResult.Items) {
      return [];
    }

    return data.SearchResult.Items.map((item: any) => {
      // Extract title
      const title = item.ItemInfo?.Title?.DisplayValue || 'Unknown Title';
      
      // Extract price information
      let price: number | undefined;
      let currency = 'USD';
      
      if (item.Offers?.Summaries?.[0]?.LowestPrice) {
        const priceData = item.Offers.Summaries[0].LowestPrice;
        price = priceData.Amount;
        currency = priceData.Currency;
      }

      // Extract image URL
      let imageUrl: string | undefined;
      if (item.Images?.Primary?.Medium?.URL) {
        imageUrl = item.Images.Primary.Medium.URL;
      }

      // Build product URL with affiliate tag
      const url = `https://www.amazon.com/dp/${item.ASIN}?tag=${this.partnerTag}`;

      return {
        asin: item.ASIN,
        title,
        price,
        currency,
        url,
        imageUrl
      };
    });
  }

  /**
   * Format API error for better user experience
   */
  private formatApiError(error: any): string {
    if (error.response && error.response.text) {
      try {
        const errorBody = JSON.parse(error.response.text);
        if (errorBody.Errors && errorBody.Errors.length > 0) {
          return errorBody.Errors[0].Message;
        }
      } catch (e) {
        // Fall back to original error
      }
    }
    
    return error.message || 'Unknown Amazon API error';
  }

  /**
   * Update game price in database using Amazon API
   */
  async updateGamePrice(gameId: string, gameTitle: string): Promise<boolean> {
    try {
      const searchResult = await this.searchBoardGames(gameTitle, {
        maxResults: 1,
        sortBy: 'Relevance'
      });

      if (!searchResult.success || !searchResult.items || searchResult.items.length === 0) {
        console.log(`⚠️ No Amazon results found for: ${gameTitle}`);
        return false;
      }

      const product = searchResult.items[0];
      
      if (!product.price) {
        console.log(`⚠️ No price available for: ${gameTitle}`);
        return false;
      }

      // Save to database
      if (!supabase) {
        console.warn('⚠️ Supabase not available, skipping database save');
        return false;
      }

      const { error } = await supabase
        .from('game_prices')
        .upsert({
          game_id: parseInt(gameId),
          store_name: 'Amazon',
          price: product.price,
          currency: product.currency || 'USD',
          url: product.url,
          last_updated: new Date().toISOString()
        }, {
          onConflict: 'game_id,store_name'
        });

      if (error) {
        console.error('❌ Database error:', error);
        return false;
      }

      console.log(`✅ Updated price for ${gameTitle}: $${product.price}`);
      return true;

    } catch (error) {
      console.error('❌ Error updating game price:', error);
      return false;
    }
  }
}

export default AmazonAPIServiceV2;
