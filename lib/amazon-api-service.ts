/* eslint-disable @typescript-eslint/no-explicit-any */

// Import the Amazon PA API SDK components
const paapi = require('paapi5-nodejs-sdk');
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

export class AmazonAPIService {
  private client: any;
  private partnerTag: string;
  private partnerType: string = 'Associates';
  private marketplace: string = 'www.amazon.com';

  constructor() {
    // Initialize the Amazon PA API client
    const accessKey = process.env.AMAZON_ACCESS_KEY;
    const secretKey = process.env.AMAZON_SECRET_KEY;
    this.partnerTag = process.env.AMAZON_PARTNER_TAG || '';

    if (!accessKey || !secretKey || !this.partnerTag) {
      console.warn('⚠️ Amazon API credentials not configured. API will not be available.');
      return;
    }

    try {
      this.client = paapi.ApiClient.instance;
      this.client.accessKey = accessKey;
      this.client.secretKey = secretKey;
      this.client.host = 'webservices.amazon.com';
      this.client.region = 'us-east-1';
      
      console.log('✅ Amazon Product Advertising API initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Amazon API:', error);
    }
  }

  /**
   * Search for board games using the SearchItems operation
   */
  async searchBoardGames(gameTitle: string, options: {
    maxResults?: number;
    sortBy?: 'Relevance' | 'Price:LowToHigh' | 'Price:HighToLow' | 'AvgCustomerReviews';
    minReviewsRating?: number;
  } = {}): Promise<AmazonSearchResult> {
    if (!this.client) {
      return { success: false, error: 'Amazon API not initialized' };
    }

    try {
      console.log(`🔍 Searching Amazon for: ${gameTitle}`);

      // Create the search request with proper structure
      const searchItemsRequest = new paapi.SearchItemsRequest();
      
      // Set required parameters (these are mandatory)
      searchItemsRequest['PartnerTag'] = this.partnerTag;
      searchItemsRequest['PartnerType'] = this.partnerType;  
      searchItemsRequest['Marketplace'] = this.marketplace;
      
      // Search parameters
      searchItemsRequest['Keywords'] = `${gameTitle} board game`;
      searchItemsRequest['SearchIndex'] = 'ToysAndGames';
      searchItemsRequest['ItemCount'] = Math.min(options.maxResults || 5, 10); // Start with fewer items
      
      // Optional sort (only set if not default)
      if (options.sortBy && options.sortBy !== 'Relevance') {
        searchItemsRequest['SortBy'] = options.sortBy;
      }
      
      // Optional filters
      if (options.minReviewsRating) {
        searchItemsRequest['MinReviewsRating'] = options.minReviewsRating;
      }
      
      // Request only essential resources to avoid overloading
      searchItemsRequest['Resources'] = [
        'Images.Primary.Medium',
        'ItemInfo.Title', 
        'Offers.Listings.Price',
        'Offers.Summaries.LowestPrice'
      ];

      // Execute the search
      const searchItemsApi = new paapi.DefaultApi();
      
      return new Promise((resolve) => {
        searchItemsApi.searchItems(searchItemsRequest, (error: any, data: any) => {
          if (error) {
            console.error('❌ Amazon API search error:', error);
            resolve({ 
              success: false, 
              error: this.formatApiError(error)
            });
            return;
          }

          if (!data || !data.SearchResult || !data.SearchResult.Items) {
            console.log('⚠️ No items found in Amazon search results');
            resolve({ 
              success: true, 
              items: [],
              totalResults: 0
            });
            return;
          }

          // Parse the results
          const items = this.parseSearchResults(data.SearchResult.Items);
          const totalResults = data.SearchResult.TotalResultCount || items.length;

          console.log(`✅ Found ${items.length} Amazon results for "${gameTitle}"`);
          
          resolve({
            success: true,
            items,
            totalResults
          });
        });
      });

    } catch (error) {
      console.error('❌ Amazon search error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get specific items by ASIN
   */
  async getItems(asins: string[]): Promise<AmazonSearchResult> {
    if (!this.client) {
      return { success: false, error: 'Amazon API not initialized' };
    }

    if (!asins.length || asins.length > 10) {
      return { success: false, error: 'Invalid ASIN count (1-10 allowed)' };
    }

    try {
      console.log(`🔍 Getting Amazon items: ${asins.join(', ')}`);

      const getItemsRequest = new paapi.GetItemsRequest();
      
      getItemsRequest.partnerTag = this.partnerTag;
      getItemsRequest.partnerType = this.partnerType;
      getItemsRequest.marketplace = this.marketplace;
      getItemsRequest.itemIds = asins;
      
      getItemsRequest.resources = [
        'Images.Primary.Medium',
        'ItemInfo.Title',
        'ItemInfo.Features',
        'Offers.Listings.Price',
        'Offers.Listings.Availability.Type',
        'Offers.Listings.Availability.Message',
        'Offers.Listings.DeliveryInfo.IsPrimeEligible',
        'Offers.Summaries.LowestPrice',
        'CustomerReviews.StarRating',
        'CustomerReviews.Count'
      ];

      const getItemsApi = new paapi.DefaultApi();
      
      return new Promise((resolve) => {
        getItemsApi.getItems(getItemsRequest, (error: any, data: any) => {
          if (error) {
            console.error('❌ Amazon GetItems error:', error);
            resolve({ 
              success: false, 
              error: this.formatApiError(error)
            });
            return;
          }

          if (!data || !data.ItemsResult || !data.ItemsResult.Items) {
            resolve({ 
              success: true, 
              items: [],
              totalResults: 0
            });
            return;
          }

          const items = this.parseSearchResults(data.ItemsResult.Items);
          
          console.log(`✅ Retrieved ${items.length} Amazon items`);
          
          resolve({
            success: true,
            items,
            totalResults: items.length
          });
        });
      });

    } catch (error) {
      console.error('❌ Amazon GetItems error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save Amazon product data to database
   */
  async saveToDatabase(gameId: string, product: AmazonProduct): Promise<boolean> {
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
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase
        .from('game_prices')
        .upsert([priceData], { onConflict: 'game_id,store_name' });

      if (error) {
        console.error('❌ Database save error:', error);
        return false;
      }

      console.log(`💾 Saved Amazon price for game ${gameId}: $${product.price}`);
      return true;

    } catch (error) {
      console.error('❌ Database save error:', error);
      return false;
    }
  }

  /**
   * Update game prices using Amazon API
   */
  async updateGamePrice(gameId: string, gameTitle: string): Promise<boolean> {
    try {
      const searchResult = await this.searchBoardGames(gameTitle, {
        maxResults: 3,
        sortBy: 'Relevance',
        minReviewsRating: 3
      });

      if (!searchResult.success || !searchResult.items?.length) {
        console.log(`⚠️ No Amazon results found for: ${gameTitle}`);
        return false;
      }

      // Find the best matching product
      const bestMatch = this.findBestMatch(gameTitle, searchResult.items);
      
      if (!bestMatch || !bestMatch.price) {
        console.log(`⚠️ No suitable Amazon product found for: ${gameTitle}`);
        return false;
      }

      // Save to database
      const saved = await this.saveToDatabase(gameId, bestMatch);
      
      if (saved) {
        console.log(`✅ Updated Amazon price for ${gameTitle}: $${bestMatch.price}`);
        return true;
      }

      return false;

    } catch (error) {
      console.error(`❌ Error updating Amazon price for ${gameTitle}:`, error);
      return false;
    }
  }

  /**
   * Parse Amazon API search results
   */
  private parseSearchResults(items: any[]): AmazonProduct[] {
    return items.map(item => this.parseAmazonItem(item)).filter((item): item is AmazonProduct => item !== null);
  }

  /**
   * Parse a single Amazon API item
   */
  private parseAmazonItem(item: any): AmazonProduct | null {
    try {
      if (!item.ASIN || !item.ItemInfo?.Title?.DisplayValue) {
        return null;
      }

      const product: AmazonProduct = {
        asin: item.ASIN,
        title: item.ItemInfo.Title.DisplayValue,
        url: item.DetailPageURL || `https://www.amazon.com/dp/${item.ASIN}?tag=${this.partnerTag}`
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

  /**
   * Find the best matching product from search results with VERY strict matching
   */
  private findBestMatch(gameTitle: string, products: AmazonProduct[]): AmazonProduct | null {
    if (!products.length) return null;

    console.log(`   🔍 Analyzing ${products.length} Amazon results for "${gameTitle}"`);

    // MUCH stricter scoring algorithm
    const scored = products.map(product => {
      let score = 0;
      let matchDetails: string[] = [];
      
      const gameWords = this.normalizeTitle(gameTitle);
      const productWords = this.normalizeTitle(product.title);
      const productTitle = productWords.join(' ');
      
      // 1. EXACT TITLE MATCH (highest priority) - must include game name exactly as distinct words
      const gamePhrase = gameWords.join(' ');
      
      // For single-word games, be VERY strict - the word should be prominent (at start or standalone)
      let exactMatch = false;
      
      if (gameWords.length === 1) {
        const gameWord = gameWords[0];
        // Single word must be at the very beginning of the title 
        const startsWithGame = new RegExp(`^${gameWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(productTitle);
        // OR be the exact standalone title with "card game" immediately after
        const exactCardGame = new RegExp(`^${gameWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+(card\\s+)?game\\b`, 'i').test(productTitle);
        
        exactMatch = startsWithGame || exactCardGame;
      } else {
        // For multi-word games, check for exact phrase match (with word boundaries)
        const exactPhraseMatch = new RegExp(`\\b${gamePhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(productTitle);
        exactMatch = exactPhraseMatch;
      }
      
      if (exactMatch) {
        score += 200; // Much higher score for exact matches
        matchDetails.push('exact-title-match');
      } else {
        // If no exact match, apply heavy penalty
        score -= 100;
        matchDetails.push('no-exact-match');
      }
      
      // 2. CORE WORD MATCHING - Handle short titles specially
      const boardGameDescriptors = [
        'board', 'game', 'boardgame', 'strategy', 'tabletop', 'card', 'classic',
        'award', 'winning', 'players', 'edition', 'deluxe', 'reiner', 'knizia'
      ];
      
      const significantGameWords = gameWords.filter(word => 
        (word.length > 2 || gameWords.length <= 2) && // Allow short words if the title is very short
        !this.isCommonWord(word) &&
        !this.isPublisherWord(word) &&
        !boardGameDescriptors.includes(word.toLowerCase()) // Exclude board game descriptors
      );
      
      let coreWordsFound = 0;
      let exactMatches = 0;
      
      significantGameWords.forEach(word => {
        const exactMatch = productWords.includes(word);
        const partialMatch = productWords.some((pw: string) => 
          (pw.length > 4 && word.length > 4 && 
           (pw.includes(word) || word.includes(pw)))
        );
        
        if (exactMatch) {
          coreWordsFound++;
          exactMatches++;
          score += 25; // Bonus for exact word matches
        } else if (partialMatch) {
          coreWordsFound++;
          score += 10; // Less bonus for partial matches
        }
      });
      
      // For very short titles (1-2 words), be more lenient
      const isShortTitle = gameWords.length <= 2;
      const requiredMatchRatio = isShortTitle ? 0.5 : 1.0; // Only require 50% match for short titles
      
      const wordMatchRatio = significantGameWords.length > 0 ? coreWordsFound / significantGameWords.length : 1.0;
      if (wordMatchRatio < requiredMatchRatio) {
        const penalty = isShortTitle ? -100 : -200; // Less harsh penalty for short titles
        score += penalty;
        matchDetails.push(`missing-words-${Math.round((1 - wordMatchRatio) * 100)}%`);
      } else {
        matchDetails.push(`sufficient-word-match`);
      }
      
      // Bonus for having mostly exact word matches
      const exactMatchRatio = significantGameWords.length > 0 ? exactMatches / significantGameWords.length : 0;
      if (exactMatchRatio >= 0.8) {
        score += 50;
        matchDetails.push('mostly-exact-matches');
      }
      
      // 3. BOARD GAME INDICATORS - required
      const boardGameIndicators = ['board game', 'boardgame', 'tabletop', 'strategy game', 'card game'];
      const hasBoardGameIndicator = boardGameIndicators.some(indicator => 
        productTitle.includes(indicator)
      );
      if (hasBoardGameIndicator) {
        score += 30;
        matchDetails.push('board-game-indicator');
      } else {
        score -= 50; // Heavy penalty for non-board game products
        matchDetails.push('no-board-game-indicator');
      }
      
      // 4. PUBLISHER/BRAND VALIDATION
      if (this.hasKnownBoardGamePublisher(product.title)) {
        score += 30;
        matchDetails.push('known-publisher');
      }
      
      // 5. PRICE REASONABLENESS for board games
      if (product.price) {
        if (product.price >= 15 && product.price <= 200) {
          score += 20;
          matchDetails.push('reasonable-price');
        } else if (product.price < 15) {
          score -= 50; // Heavy penalty for cheap items
          matchDetails.push('too-cheap');
        } else if (product.price > 200) {
          score -= 20; // Penalty for very expensive items
          matchDetails.push('expensive');
        }
      } else {
        score -= 30; // No price available
        matchDetails.push('no-price');
      }
      
      // 6. NEGATIVE INDICATORS (automatic rejection for accessories)
      const negativeIndicators = [
        'expansion', 'sleeve', 'sleeves', 'dice', 'token', 'tokens', 
        'mat', 'playmat', 'organizer', 'insert', 'upgrade', 'accessory',
        'miniature', 'mini', 'figure', 'figurine', 'card sleeves',
        'storage', 'box', 'case', 'bag', 'component'
      ];
      
      negativeIndicators.forEach(indicator => {
        if (productTitle.includes(indicator)) {
          score -= 100; // Massive penalty for accessories
          matchDetails.push(`negative-${indicator}`);
        }
      });
      
      // 7. VERY STRICT: Reject products that seem to be different games entirely
      const suspiciousPatterns = [
        // Common mismatches we've seen
        'TV show', 'television', 'movie', 'film', 
        'bible', 'felt board', 'educational',
        'teen titans', 'office', 'skyjo', 'tapple',
        'azul', 'wingspan', 'pandemic' // Don't match to other well-known games
      ];
      
      suspiciousPatterns.forEach(pattern => {
        if (productTitle.includes(pattern.toLowerCase()) && !gamePhrase.includes(pattern.toLowerCase())) {
          score -= 150; // Huge penalty for obvious mismatches
          matchDetails.push(`suspicious-${pattern}`);
        }
      });
      
      // 8. Quality indicators (smaller impact)
      if (product.rating && product.rating >= 4.0) {
        score += 5;
        matchDetails.push('good-rating');
      }
      
      if (product.reviewCount && product.reviewCount >= 50) {
        score += 5;
        matchDetails.push('many-reviews');
      }
      
      if (product.prime) {
        score += 3;
        matchDetails.push('prime-eligible');
      }

      return { 
        product, 
        score, 
        matchDetails,
        wordMatchRatio: Math.round(wordMatchRatio * 100),
        exactMatchRatio: Math.round(exactMatchRatio * 100)
      };
    });

    // Sort by score and log details
    scored.sort((a, b) => b.score - a.score);
    
    console.log('   📊 Match Analysis:');
    scored.slice(0, 3).forEach((item, index) => {
      const truncatedTitle = item.product.title.length > 50 
        ? item.product.title.substring(0, 50) + '...' 
        : item.product.title;
      console.log(`   ${index + 1}. Score: ${item.score} | ${truncatedTitle}`);
      console.log(`      💰 $${item.product.price || 'N/A'} | Words: ${item.wordMatchRatio}% | Exact: ${item.exactMatchRatio}%`);
      console.log(`      🔍 ${item.matchDetails.join(', ')}`);
    });
    
    // MUCH higher minimum score required, but adjusted for short titles
    const bestMatch = scored[0];
    const isShortTitle = this.normalizeTitle(gameTitle).length <= 2;
    const minimumScore = isShortTitle ? 75 : 150; // Lower threshold for short titles like "Ra"
    
    if (bestMatch && bestMatch.score >= minimumScore && bestMatch.product.price) {
      console.log(`   ✅ Selected match with score ${bestMatch.score} (required: ${minimumScore})`);
      return bestMatch.product;
    } else {
      console.log(`   ❌ NO SUITABLE MATCH (best score: ${bestMatch?.score || 0}, required: ${minimumScore})`);
      return null;
    }
  }

  /**
   * Normalize title for better matching
   */
  private normalizeTitle(title: string): string[] {
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  /**
   * Check if a word is too common to be useful for matching
   */
  private isCommonWord(word: string): boolean {
    const commonWords = [
      'the', 'and', 'or', 'of', 'to', 'a', 'an', 'in', 'on', 'at', 'by', 'for',
      'with', 'from', 'game', 'board', 'card', 'edition', 'new', 'original'
    ];
    return commonWords.includes(word.toLowerCase());
  }

  /**
   * Check if a word is likely a publisher name (less critical for matching)
   */
  private isPublisherWord(word: string): boolean {
    const publishers = [
      'games', 'entertainment', 'studios', 'publishing', 'press', 'company',
      'asmodee', 'hasbro', 'mattel', 'ravensburger', 'kosmos'
    ];
    return publishers.includes(word.toLowerCase());
  }

  /**
   * Check if the product title contains a known board game publisher
   */
  private hasKnownBoardGamePublisher(title: string): boolean {
    const knownPublishers = [
      'asmodee', 'stonemaier', 'cephalofair', 'fantasy flight', 'z-man',
      'renegade', 'restoration games', 'plan b', 'repos production',
      'ravensburger', 'kosmos', 'lookout games', 'rio grande',
      'portal games', 'czech games', 'space cowboys', 'iello',
      'alderac', 'aeg', 'stronghold', 'tasty minstrel', 'bezier'
    ];
    
    const lowerTitle = title.toLowerCase();
    return knownPublishers.some(publisher => lowerTitle.includes(publisher));
  }

  /**
   * Format API error messages
   */
  private formatApiError(error: any): string {
    if (error.response?.body?.Errors?.[0]) {
      return error.response.body.Errors[0].Message || 'API Error';
    }
    
    if (error.message) {
      return error.message;
    }
    
    return 'Unknown Amazon API error';
  }

  /**
   * Check if API is available
   */
  isAvailable(): boolean {
    return !!this.client;
  }

  /**
   * Get API rate limit information
   */
  getRateLimitInfo(): { requestsPerSecond: number; dailyLimit: number } {
    // Amazon PA API rate limits (typical for Associates)
    return {
      requestsPerSecond: 0.5, // 1 request every 2 seconds for safety
      dailyLimit: 8640 // Varies by account volume
    };
  }
}

// Export singleton instance
export const amazonAPIService = new AmazonAPIService();
