# 🔑 Amazon API Setup Guide

## Quick Setup Steps

### 1. **Get Your Amazon API Credentials**

You need these 3 pieces of information from your Amazon Associates account:

1. **Access Key** - From PA API registration  
2. **Secret Key** - From PA API registration
3. **Partner Tag** - Your Amazon Associates tracking ID (usually ends with `-20`)

### 2. **Configure Credentials**

**Option A: Edit Setup Script (Recommended)**
1. Open `scripts/setup-amazon-credentials.ts`
2. Find the `credentials` object around line 40
3. Replace the placeholder values:
   ```typescript
   const credentials: AmazonCredentials = {
     accessKey: 'YOUR_ACTUAL_ACCESS_KEY',      // ← Replace this
     secretKey: 'YOUR_ACTUAL_SECRET_KEY',      // ← Replace this  
     partnerTag: 'YOUR_ACTUAL_PARTNER_TAG'     // ← Replace this
   };
   ```
4. Run: `npm run setup:amazon`

**Option B: Manual .env.local Edit**
Add these lines to your `.env.local` file:
```env
AMAZON_ACCESS_KEY=your-access-key
AMAZON_SECRET_KEY=your-secret-key
AMAZON_PARTNER_TAG=your-partner-tag-20
```

### 3. **Test Your Setup**

```bash
# Check credentials are set
npx tsx scripts/check-amazon-credentials.ts

# Test API functionality  
npm run test:amazon-simple

# Full API test suite
npm run test:amazon-api
```

## Expected Output

When working correctly, you should see:
```
🧪 Testing Amazon Product Advertising API
==========================================

✅ Amazon API service initialized successfully
🔍 Searching for: "Wingspan"
✅ Found 3 results:

1. Wingspan Board Game - A Bird-Collecting Engine Building Game
   💰 Price: $52.99
   🔗 URL: https://www.amazon.com/dp/B077XXBQZF?tag=yourtag-20
   🆔 ASIN: B077XXBQZF

💾 Testing database save...
✅ Successfully saved price to database

🎉 Amazon API is working correctly!
```

## Troubleshooting

### ❌ "Invalid API credentials" 
- Double-check your Access Key and Secret Key
- Ensure your Amazon Associates account is approved
- Verify PA API access has been granted (separate approval needed)

### ❌ "Invalid Partner Tag"
- Make sure it's your Amazon Associates tracking ID
- Usually ends with `-20` (e.g., `yourname-20`)
- Check your Amazon Associates dashboard

### ❌ "Request Throttled" 
- Amazon has rate limits (1 request per second)
- Wait a moment and try again
- Our code has built-in rate limiting

### ❌ "No results found"
- Try different game titles
- Some games might not be in Amazon's catalog
- Check if your Associate tag is active

## Next Steps

Once your API is working:

1. **Test complete pipeline:**
   ```bash
   npm run test:complete-pipeline
   ```

2. **Start using for price collection:**
   ```bash
   npm run prices:api
   ```

3. **Integration with recommendations:**
   The API will automatically be used in your game recommendation system!

## API Benefits

✅ **No bot detection issues**  
✅ **Real-time pricing**  
✅ **Rich product metadata**  
✅ **Affiliate links built-in**  
✅ **Official Amazon support**  
✅ **Higher rate limits**  

Your purchase links feature will be much more reliable with the official API!
