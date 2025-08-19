import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

console.log('🔧 Setting up database connection...');

// Check environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Environment check:');
console.log(`  NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'Set' : 'Missing'}`);
console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'Set' : 'Missing'}`);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabaseConnection() {
  console.log('\n🧪 Testing database connection...');

  try {
    // Test 1: Simple health check
    console.log('1. Testing basic connectivity...');
    const { data, error } = await supabase.from('games').select('id').limit(1);
    
    if (error) {
      console.error('❌ Database connection failed:', error.message);
      return false;
    }

    console.log('✅ Basic connectivity works');

    // Test 2: Check if game_prices table exists
    console.log('2. Checking game_prices table...');
    const { data: pricesData, error: pricesError } = await supabase
      .from('game_prices')
      .select('*')
      .limit(1);

    if (pricesError) {
      if (pricesError.message.includes('does not exist') || pricesError.code === '42P01') {
        console.log('⚠️ game_prices table does not exist - will need to create it');
        
        // Try to create the table
        console.log('3. Creating game_prices table...');
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS game_prices (
            id SERIAL PRIMARY KEY,
            game_id VARCHAR(255) NOT NULL,
            store_name VARCHAR(100) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            currency VARCHAR(3) DEFAULT 'USD',
            url TEXT,
            last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(game_id, store_name)
          );
        `;

        const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
        
        if (createError) {
          console.error('❌ Failed to create game_prices table:', createError.message);
          console.log('📋 You may need to create this table manually in Supabase dashboard');
          return false;
        }

        console.log('✅ game_prices table created successfully');
      } else {
        console.error('❌ game_prices table error:', pricesError.message);
        return false;
      }
    } else {
      console.log('✅ game_prices table exists and accessible');
    }

    // Test 3: Check games table
    console.log('4. Checking games table...');
    const { data: gamesData, error: gamesError } = await supabase
      .from('games')
      .select('id, title')
      .limit(5);

    if (gamesError) {
      console.error('❌ games table error:', gamesError.message);
      return false;
    }

    console.log(`✅ games table accessible with ${gamesData?.length || 0} sample records`);
    
    if (gamesData && gamesData.length > 0) {
      console.log('Sample games:');
      gamesData.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.title} (ID: ${game.id})`);
      });
    }

    console.log('\n🎉 Database setup completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Database test failed:', error);
    return false;
  }
}

// Run the test
testDatabaseConnection().then(success => {
  if (success) {
    console.log('\n✅ Database is ready for price collection!');
  } else {
    console.log('\n❌ Database setup failed. Please check configuration.');
    process.exit(1);
  }
}).catch(error => {
  console.error('❌ Test script failed:', error);
  process.exit(1);
});
