/* eslint-disable @typescript-eslint/no-explicit-any */

// Custom Amazon PA API client without SDK dependencies
import { supabase } from './supabase';
import crypto from 'crypto';

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

export class AmazonAPIServiceV3 {
  private accessKey: string;
  private secretKey: string;
  private partnerTag: string;
  private partnerType: string = 'Associates';
  private marketplace: string = 'www.amazon.com';
  private host: string = 'webservices.amazon.com';
  private region: string = 'us-east-1';
  private service: string = 'ProductAdvertisingAPI';
  private lastRequestTime: number = 0;
  private minDelayMs: number = 1200; // 1.2 seconds between requests (conservative)
  private isInitialized: boolean = false;

  constructor() {
    this.accessKey = process.env.AMAZON_ACCESS_KEY || '';
    this.secretKey = process.env.AMAZON_SECRET_KEY || '';
    this.partnerTag = process.env.AMAZON_PARTNER_TAG || '';

    if (!this.accessKey || !this.secretKey || !this.partnerTag) {
      console.warn('⚠️ Amazon API credentials not configured. API will not be available.');
      return;
    }

    this.isInitialized = true;
    console.log('✅ Amazon Product Advertising API V3 initialized (SDK-free)');
  }

  /**
   * Create AWS4 signature for Amazon PA API
   */
  private createSignature(method: string, uri: string, queryString: string, payload: string, timestamp: string): string {
    const date = timestamp.substr(0, 8);
    const credentialScope = `${date}/${this.region}/${this.service}/aws4_request`;
    
    // Create canonical request
    const canonicalHeaders = `host:${this.host}\n` +
                           `x-amz-date:${timestamp}\n` +
                           `x-amz-target:com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems\n`;
    
    const signedHeaders = 'host;x-amz-date;x-amz-target';
    
    const canonicalRequest = `${method}\n${uri}\n${queryString}\n${canonicalHeaders}\n${signedHeaders}\n${this.hash(payload)}`;
    
    // Create string to sign
    const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${this.hash(canonicalRequest)}`;
    
    // Create signing key
    const signingKey = this.getSignatureKey(this.secretKey, date, this.region, this.service);
    
    // Create signature
    const signature = crypto.createHmac('sha256', signingKey as unknown as crypto.BinaryLike).update(stringToSign).digest('hex');
    
    return `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  private hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
    const kDate = crypto.createHmac('sha256', 'AWS4' + key).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate as unknown as crypto.BinaryLike).update(regionName).digest();
    const kService = crypto.createHmac('sha256', kRegion as unknown as crypto.BinaryLike).update(serviceName).digest();
    const kSigning = crypto.createHmac('sha256', kService as unknown as crypto.BinaryLike).update('aws4_request').digest();
    return kSigning;
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
   * Search for board games using direct HTTP requests to Amazon PA API
   */
  async searchBoardGames(gameTitle: string, options: {
    maxResults?: number;
    sortBy?: 'Relevance' | 'Price:LowToHigh' | 'Price:HighToLow' | 'AvgCustomerReviews';
    minReviewsRating?: number;
  } = {}): Promise<AmazonSearchResult> {
    if (!this.isInitialized) {
      return { success: false, error: 'Amazon API not initialized' };
    }

    try {
      // Enforce rate limiting
      await this.enforceRateLimit();

      console.log(`🔍 Searching Amazon for: ${gameTitle}`);

      // Create request payload
      const payload: any = {
        PartnerTag: this.partnerTag,
        PartnerType: this.partnerType,
        Marketplace: this.marketplace,
        Keywords: gameTitle,
        SearchIndex: 'ToysAndGames',
        ItemCount: Math.min(options.maxResults || 5, 5),
        Resources: [
          'ItemInfo.Title',
          'Offers.Summaries.LowestPrice',
          'Images.Primary.Medium'
        ]
      };

      // Add optional parameters
      if (options.sortBy && options.sortBy !== 'Relevance') {
        payload.SortBy = options.sortBy;
      }

      const payloadString = JSON.stringify(payload);
      const timestamp = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, '');
      
      // Create signature
      const signature = this.createSignature('POST', '/paapi5/searchitems', '', payloadString, timestamp);

      // Make HTTP request
      const response = await fetch(`https://${this.host}/paapi5/searchitems`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Authorization': signature,
          'X-Amz-Date': timestamp,
          'X-Amz-Target': 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems'
        },
        body: payloadString
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Amazon API HTTP error:', response.status, errorText);
        
        if (response.status === 429) {
          return { 
            success: false, 
            error: 'Rate limit exceeded. Please wait before making another request.'
          };
        }
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText}`
        };
      }

      const data = await response.json();

      // Process successful response
      const items = this.processSearchResponse(data);
      console.log(`✅ Found ${items.length} products for "${gameTitle}"`);
      
      return {
        success: true,
        items,
        totalResults: items.length
      };

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

export default AmazonAPIServiceV3;
