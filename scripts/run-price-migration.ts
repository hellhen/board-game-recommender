import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addPriceColumns() {
  console.log('🔧 Adding price table columns...');
  
  const migrations = [
    // Add availability column
    `ALTER TABLE game_prices ADD COLUMN IF NOT EXISTS availability TEXT DEFAULT 'unknown'`,
    
    // Add check constraint for availability
    `ALTER TABLE game_prices DROP CONSTRAINT IF EXISTS game_prices_availability_check`,
    `ALTER TABLE game_prices ADD CONSTRAINT game_prices_availability_check 
     CHECK (availability IN ('in-stock', 'out-of-stock', 'unknown'))`,
    
    // Add affiliate_url column
    `ALTER TABLE game_prices ADD COLUMN IF NOT EXISTS affiliate_url TEXT`,
    
    // Add scrape_confidence column
    `ALTER TABLE game_prices ADD COLUMN IF NOT EXISTS scrape_confidence DECIMAL(3,2) DEFAULT 0.0`,
    
    // Add check constraint for confidence
    `ALTER TABLE game_prices DROP CONSTRAINT IF EXISTS game_prices_confidence_check`,
    `ALTER TABLE game_prices ADD CONSTRAINT game_prices_confidence_check 
     CHECK (scrape_confidence >= 0.0 AND scrape_confidence <= 1.0)`,
    
    // Create unique constraint if it doesn't exist
    `ALTER TABLE game_prices DROP CONSTRAINT IF EXISTS unique_game_store_price`,
    `ALTER TABLE game_prices ADD CONSTRAINT unique_game_store_price 
     UNIQUE (game_id, store_name)`,
    
    // Create indexes for better performance
    `CREATE INDEX IF NOT EXISTS idx_game_prices_availability ON game_prices (availability)`,
    `CREATE INDEX IF NOT EXISTS idx_game_prices_confidence ON game_prices (scrape_confidence)`,
    `CREATE INDEX IF NOT EXISTS idx_game_prices_game_price_availability 
     ON game_prices (game_id, price, availability)`
  ];
  
  let successCount = 0;
  
  for (let i = 0; i < migrations.length; i++) {
    const sql = migrations[i];
    console.log(`⏳ Running migration ${i + 1}/${migrations.length}...`);
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql });
      
      if (error) {
        console.warn(`⚠️ Warning on migration ${i + 1}: ${error.message}`);
        // Many of these will "fail" if columns already exist, which is fine
      } else {
        console.log(`✅ Migration ${i + 1} completed`);
        successCount++;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`⚠️ Error on migration ${i + 1}: ${errorMessage}`);
    }
  }
  
  console.log(`\n📊 Migration summary: ${successCount}/${migrations.length} migrations completed`);
  return successCount > 0;
}

async function testTableStructure() {
  console.log('\n🧪 Testing table structure...');
  
  try {
    // Test if we can query the game_prices table with new columns
    const { data, error } = await supabase
      .from('game_prices')
      .select('game_id, store_name, price, availability, affiliate_url, scrape_confidence, last_updated')
      .limit(1);
    
    if (error) {
      console.error('❌ Error querying game_prices table:', error);
      return false;
    }
    
    console.log('✅ game_prices table structure looks good!');
    console.log('Sample columns:', Object.keys(data?.[0] || {}));
    return true;
    
  } catch (err) {
    console.error('❌ Error testing table:', err);
    return false;
  }
}

async function runMigration() {
  console.log('🚀 Starting Price Table Migration');
  console.log('==================================\n');
  
  try {
    const migrationSuccess = await addPriceColumns();
    const testSuccess = await testTableStructure();
    
    if (migrationSuccess && testSuccess) {
      console.log('\n🎉 Migration completed successfully!');
      console.log('✅ Ready to test price scraping with database');
    } else {
      console.log('\n⚠️ Migration completed with warnings');
      console.log('🔍 Check the output above for any issues');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Unhandled error:', error);
      process.exit(1);
    });
}
