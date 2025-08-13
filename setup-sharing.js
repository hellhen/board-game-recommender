const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createMinimalShareTable() {
  console.log('Creating minimal shared recommendations support...');
  
  try {
    // Instead of creating a new table, let's use the existing user_recommendations table
    // and add sharing functionality by making some recommendations public
    
    // First, let's test if we can access the existing user_recommendations table
    const { data: testData, error: testError } = await supabase
      .from('user_recommendations')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Cannot access user_recommendations table:', testError);
      return;
    }
    
    console.log('✓ user_recommendations table is accessible');
    console.log('We\'ll use the existing table with a sharing approach');
    
    // We'll store shared recommendations as regular user_recommendations
    // with a special session_id format for shared ones
    
    console.log('✓ Ready to implement sharing using existing infrastructure');
    
  } catch (error) {
    console.error('Setup failed:', error);
  }
}

createMinimalShareTable();
