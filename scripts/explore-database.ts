import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function exploreDatabase() {
  console.log('🚀 Exploring Database Tables and Columns');
  console.log('========================================\n');

  try {
    // Get a list of all tables by trying some common queries
    console.log('🔍 Exploring available tables...\n');

    const tablesToCheck = ['games', 'game_prices', 'boardgames', 'shared_recommendations'];
    
    for (const tableName of tablesToCheck) {
      console.log(`📋 Checking table: ${tableName}`);
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`  ❌ Error: ${error.message}`);
        } else {
          console.log(`  ✅ Table exists with ${count} records`);
          
          // Get one record to see the structure
          const { data: sampleData, error: sampleError } = await supabase
            .from(tableName)
            .select('*')
            .limit(1);

          if (sampleError) {
            console.log(`  ❌ Sample query error: ${sampleError.message}`);
          } else if (sampleData && sampleData.length > 0) {
            console.log(`  📄 Columns: ${Object.keys(sampleData[0]).join(', ')}`);
          } else {
            console.log(`  📄 Table is empty`);
          }
        }
      } catch (err) {
        console.log(`  ❌ Exception: ${err}`);
      }
      console.log('');
    }

    // Special check for any existing price-related tables
    console.log('🔍 Looking for any price-related data...\n');
    
    // Check if there are any tables we might have missed
    const possiblePriceTables = ['prices', 'game_price', 'product_prices', 'price_data'];
    
    for (const tableName of possiblePriceTables) {
      console.log(`📋 Checking possible table: ${tableName}`);
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.log(`  ❌ Error: ${error.message}`);
        } else {
          console.log(`  ✅ Found table with ${count} records!`);
        }
      } catch (err) {
        console.log(`  ❌ Exception: ${err}`);
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }

  console.log('\n✅ Database exploration completed');
}

exploreDatabase();
