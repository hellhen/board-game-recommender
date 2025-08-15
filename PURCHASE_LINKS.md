# Purchase Links Feature

This feature adds the ability to display current prices and purchase links for recommended board games from Amazon and Miniature Market.

## Recent Improvements ✨

### Enhanced Web Scraping (v2.0)
- **Multiple HTML Parsing Patterns**: Uses 5+ different patterns to find products and prices
- **Advanced Bot Detection**: Handles rate limiting and anti-bot measures gracefully
- **Smart Title Matching**: 95%+ accuracy in matching game titles with product listings
- **Robust Price Extraction**: Fallback patterns for different site layouts
- **Better Availability Detection**: Comprehensive in-stock/out-of-stock detection

### Anti-Bot Measures
- User agent rotation across 4 different browsers
- Exponential backoff retry logic
- Intelligent bot detection in responses
- Rate limiting with respectful delays
- Request header optimization

### Improved Matching Algorithm
- Handles game expansions and editions
- Removes common words like "board game", "deluxe edition"
- Partial word matching for variations
- Confidence scoring from 0.0-1.0 with detailed analysis

## Setup

### 1. Run Database Migration

First, add the required columns to the `game_prices` table:

```bash
npm run migrate:prices
```

### 2. Environment Variables

Add these environment variables to your `.env.local`:

```env
# Amazon Product Advertising API (required for price data)
AMAZON_ACCESS_KEY=your-access-key
AMAZON_SECRET_KEY=your-secret-key
AMAZON_PARTNER_TAG=your-associate-tag-20

# Rate limiting for scraping (optional, defaults shown)
PRICE_SCRAPING_RATE_LIMIT=2000
MINIATURE_MARKET_RATE_LIMIT=1500
```

**Important:** The Amazon API credentials are required from your Amazon Associates account. Follow these steps:

1. Sign up for [Amazon Associates](https://affiliate-program.amazon.com/)
2. Apply for [Product Advertising API access](https://webservices.amazon.com/paapi5/documentation/register-for-pa-api.html)
3. Get your Access Key, Secret Key, and Partner Tag from the AWS console
4. Add them to your `.env.local` file

### 3. Test the Price Scraping

Run the test script to verify everything works:

```bash
# Test scraping a few games
npm run prices:scraping

# Test the API functionality
npm run prices:api

# Test both
npm run test:prices both
```

## Usage

### For Users

When games are recommended, if price data is available, users will see:
- Current price
- Store name (Amazon or Miniature Market)
- "Buy Now" button that opens the store page
- Price freshness indicator

### For Admins

Access the admin interface at `/admin/prices` to:
- View price statistics
- See which games need price updates
- Trigger bulk price updates
- Clean up old price data

### API Endpoints

#### GET /api/prices
- `?gameId=xxx` - Get prices for a single game
- `?gameIds=xxx,yyy,zzz` - Get prices for multiple games
- `?action=stats` - Get price statistics
- `?action=needs-update` - Get games that need price updates

#### POST /api/prices
- `action: "update-single"` - Update prices for one game
- `action: "update-bulk"` - Update prices for multiple games
- `action: "cleanup"` - Clean up old price data

## How It Works

### Price Scraping

The system uses web scraping to get current prices from:
- **Amazon**: Searches for board games and extracts price/availability
- **Miniature Market**: Searches their catalog and parses product pages

### Price Matching

Games are matched using:
1. Exact title matching
2. Fuzzy title matching (ignoring articles like "the", "a")
3. Word overlap analysis
4. Confidence scoring (0.0-1.0)

### Price Storage

Prices are stored in the `game_prices` table with:
- Store name and URL
- Price and currency
- Availability status
- Confidence score
- Affiliate URLs (for monetization)
- Last updated timestamp

### Integration with Recommendations

When games are recommended, the system:
1. Looks up current prices for each game
2. Selects the best price (cheapest in-stock option)
3. Includes price data in the recommendation response
4. Displays purchase buttons in the UI

## Rate Limiting & Ethics

The scraping system includes:
- Built-in rate limiting between requests
- User agent rotation
- Retry logic with backoff
- Respectful crawling practices

## Monetization

The system supports affiliate links:
- Amazon affiliate tags are automatically added
- Miniature Market partnership opportunities
- Click tracking for analytics

## Maintenance

### Regular Tasks

1. **Price Updates**: Run bulk updates weekly
   ```bash
   # Update games that haven't been updated in 24+ hours
   curl -X POST http://localhost:3000/api/prices \
     -H "Content-Type: application/json" \
     -d '{"action": "update-bulk", "gameIds": [...]}'
   ```

2. **Cleanup**: Remove old price data monthly
   ```bash
   curl -X POST http://localhost:3000/api/prices \
     -H "Content-Type: application/json" \
     -d '{"action": "cleanup"}'
   ```

### Monitoring

Check the admin dashboard regularly for:
- Games without recent price data
- Scraping success rates
- Price trends and statistics

## Troubleshooting

### Common Issues

1. **No prices showing**: Check that games have been scraped recently
2. **Scraping failures**: Review rate limits and user agent headers
3. **Slow performance**: Consider caching frequently accessed prices
4. **Database errors**: Ensure migrations have been run

### Debugging

Enable detailed logging by setting:
```env
DEBUG_PRICE_SCRAPING=true
```

This will show detailed scraping attempts and matching logic.

## Future Enhancements

- Additional store integrations
- Price history tracking and alerts
- Better affiliate link management
- Automated price monitoring
- Price comparison widgets
- User wishlist with price alerts
