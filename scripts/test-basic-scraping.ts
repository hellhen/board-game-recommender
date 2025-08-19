import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables with explicit path
config({ path: '.env.local' });

console.log('🔧 Environment check:');
console.log(`- SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Not set'}`);
console.log(`- SERVICE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Not set'}`);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testBasicScraping() {
  console.log('\n🚀 Testing Basic Price Scraping');
  console.log('===============================');

  try {
    // Test database connection first
    console.log('🔗 Testing database connection...');
    const { data: games, error: dbError } = await supabase
      .from('games')
      .select('id, title')
      .limit(1);

    if (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return;
    }

    console.log(`✅ Database connected. Found game: ${games?.[0]?.title}`);
    const testGame = games?.[0];
    if (!testGame) return;

    // Test basic fetch to Amazon
    console.log('\n📦 Testing Amazon search...');
    const gameTitle = testGame.title;
    const searchQuery = encodeURIComponent(`${gameTitle} board game`);
    const searchUrl = `https://www.amazon.com/s?k=${searchQuery}&rh=n%3A165793011`;

    console.log(`🔍 Search URL: ${searchUrl}`);

    try {
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      console.log(`📡 Response status: ${response.status}`);
      console.log(`📋 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const html = await response.text();
        console.log(`📄 HTML length: ${html.length} characters`);
        
        // Check for bot detection
        if (html.includes('robot') || html.includes('captcha') || html.includes('blocked')) {
          console.log('🤖 Possible bot detection detected');
        }

        // Look for basic product indicators
        const productMatches = html.match(/data-asin="[A-Z0-9]{10}"/g);
        console.log(`🎯 Found ${productMatches?.length || 0} potential products`);

        if (productMatches && productMatches.length > 0) {
          console.log('✅ Amazon search appears to be working');
          
          // Test inserting a mock price
          console.log('\n💾 Testing price data insertion...');
          const mockPriceData = {
            game_id: testGame.id,
            store_name: 'Amazon',
            price: 29.99,
            currency: 'USD',
            url: searchUrl,
            last_updated: new Date().toISOString()
          };

          const { data: insertResult, error: insertError } = await supabase
            .from('game_prices')
            .upsert([mockPriceData], { onConflict: 'game_id,store_name' })
            .select();

          if (insertError) {
            console.error('❌ Insert failed:', insertError);
          } else {
            console.log('✅ Price data inserted successfully');
            console.log('📄 Result:', insertResult?.[0]);

            // Clean up
            await supabase
              .from('game_prices')
              .delete()
              .eq('id', insertResult?.[0]?.id);
            console.log('🧹 Test data cleaned up');
          }
        }
      } else {
        console.log('❌ Amazon request failed');
      }

    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
  }

  console.log('\n✅ Basic scraping test completed');
}

testBasicScraping();
