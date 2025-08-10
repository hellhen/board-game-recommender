import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Set up proper RLS policies that allow service role operations
 * This approach creates SQL files that you can run manually
 */
export async function generatePolicySQL(): Promise<void> {
  console.log('🔧 Generating SQL for proper database policies...\n');

  const policySQL = `
-- Drop existing overly restrictive policies
DROP POLICY IF EXISTS "Games are publicly readable" ON games;
DROP POLICY IF EXISTS "Service role can manage games" ON games;
DROP POLICY IF EXISTS "Public read access to games" ON games;

-- Create new comprehensive policies
-- Allow public read access to games
CREATE POLICY "allow_public_read_games" ON games
FOR SELECT USING (true);

-- Allow service role full access (this is the key policy for imports)
CREATE POLICY "allow_service_role_all_games" ON games
FOR ALL TO service_role USING (true);

-- Allow authenticated users to read (backup policy)
CREATE POLICY "allow_authenticated_read_games" ON games
FOR SELECT TO authenticated USING (true);

-- Test the setup
INSERT INTO games (title, bgg_id, players, playtime, complexity, mechanics, theme, tags, description)
VALUES ('POLICY_TEST_DELETE_ME', 999999, '1', '1 min', 1.0, ARRAY['test'], 'test', ARRAY['test'], 'test');

DELETE FROM games WHERE bgg_id = 999999;
`;

  console.log('📄 Policy SQL generated:');
  console.log('='.repeat(50));
  console.log(policySQL);
  console.log('='.repeat(50));
  
  console.log('\n📋 Instructions:');
  console.log('1. Copy the SQL above');
  console.log('2. Go to your Supabase dashboard');
  console.log('3. Navigate to SQL Editor');
  console.log('4. Paste and run the SQL');
  console.log('5. Then run your BGG import scripts');

  return;
}

// Alternative approach: Create a database function that can be called with elevated privileges
export async function testDatabaseAccess(): Promise<void> {
  console.log('🧪 Testing current database access...\n');

  try {
    // Test basic read
    const { data: readData, error: readError } = await supabase
      .from('games')
      .select('id, title')
      .limit(1);

    if (readError) {
      console.error('❌ Read test failed:', readError);
    } else {
      console.log('✅ Read access works');
    }

    // Test insert
    const testGame = {
      title: 'ACCESS_TEST_DELETE_ME',
      bgg_id: 999997,
      players: '1-1',
      playtime: '1 min',
      complexity: 1.0,
      mechanics: ['access-test'],
      theme: 'test',
      tags: ['test'],
      description: 'Access test record'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('games')
      .insert(testGame)
      .select();

    if (insertError) {
      console.error('❌ Insert test failed:', insertError);
      console.log('\n🔧 This means RLS policies are blocking service role access.');
      console.log('Run this script with "sql" argument to get the SQL to fix it.');
    } else {
      console.log('✅ Insert access works');
      
      // Clean up
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('bgg_id', 999997);
      
      if (deleteError) {
        console.error('❌ Delete test failed:', deleteError);
      } else {
        console.log('✅ Delete access works');
      }
    }

  } catch (error) {
    console.error('❌ Database access test failed:', error);
  }
}

// CLI execution
async function main() {
  const approach = process.argv[2] || 'test';

  try {
    if (approach === 'sql') {
      await generatePolicySQL();
    } else {
      await testDatabaseAccess();
    }
  } catch (error) {
    console.error('Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Database setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database setup failed:', error);
      process.exit(1);
    });
}
