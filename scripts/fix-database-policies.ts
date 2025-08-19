import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables first
config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function fixDatabasePolicies() {
  console.log('🔧 Fixing database RLS policies for game_prices table...\n');

  try {
    console.log('1. Checking current policies...');
    
    // Check if we can read from game_prices
    const { data: testRead, error: readError } = await supabase
      .from('game_prices')
      .select('*')
      .limit(1);

    if (readError) {
      console.error('❌ Cannot read from game_prices:', readError.message);
      return false;
    }

    console.log('✅ Read access works');

    // Try to insert a test record
    console.log('2. Testing insert permissions...');
    
    const testData = {
      game_id: 'd7565f7b-ea5d-4860-889a-da3328344408', // Using Wingspan ID from earlier
      store_name: 'Test Store',
      price: 29.99,
      currency: 'USD',
      url: 'https://example.com/test',
      last_updated: new Date().toISOString()
    };

    const { data: insertData, error: insertError } = await supabase
      .from('game_prices')
      .insert([testData])
      .select();

    if (insertError) {
      console.log('❌ Insert failed (expected):', insertError.message);
      
      if (insertError.message.includes('row-level security policy')) {
        console.log('\n3. Creating INSERT policy for game_prices...');
        
        // Create a policy that allows public inserts to game_prices
        const createPolicySQL = `
          CREATE POLICY "Allow public inserts to game_prices" ON game_prices
          FOR INSERT WITH CHECK (true);
        `;

        // Note: We can't execute DDL directly with the Supabase client
        // We need to use the SQL editor in Supabase dashboard or use a service role
        console.log('📋 SQL to execute in Supabase dashboard:');
        console.log('---');
        console.log(createPolicySQL);
        console.log('---');
        
        console.log('\n🚀 Alternative: Temporarily disable RLS for game_prices');
        console.log('Execute this in Supabase SQL editor:');
        console.log('ALTER TABLE game_prices DISABLE ROW LEVEL SECURITY;');
        
        return false;
      }
    } else {
      console.log('✅ Insert works! Cleaning up test data...');
      
      // Clean up test data
      await supabase
        .from('game_prices')
        .delete()
        .eq('store_name', 'Test Store');
        
      console.log('✅ Database policies are correctly configured');
      return true;
    }

  } catch (error) {
    console.error('❌ Error testing database policies:', error);
    return false;
  }
}

// Run the fix
fixDatabasePolicies().then(success => {
  if (success) {
    console.log('\n🎉 Database is ready for price updates!');
  } else {
    console.log('\n⚠️  Manual intervention required in Supabase dashboard');
    console.log('\nOptions:');
    console.log('1. Execute the CREATE POLICY statement shown above');
    console.log('2. Temporarily disable RLS with: ALTER TABLE game_prices DISABLE ROW LEVEL SECURITY;');
    console.log('3. Add a service role key to your environment variables');
  }
}).catch(error => {
  console.error('❌ Script failed:', error);
});
