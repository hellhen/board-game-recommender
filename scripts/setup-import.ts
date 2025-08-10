import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function disableRLSForImport() {
  console.log('Temporarily disabling RLS for games table to allow imports...');
  
  // Since we can't execute arbitrary SQL through the client API directly,
  // we'll need to handle RLS differently. Let's try to create proper policies instead.
  
  // For now, let's just test a simple insert to see if our service key works
  const testGame = {
    title: 'BGG Import Test',
    bgg_id: 999998,
    players: '1-4',
    playtime: '45 min',
    complexity: 2.5,
    mechanics: ['test-mechanic'],
    theme: 'test',
    tags: ['test'],
    description: 'Test game for BGG import'
  };

  console.log('Testing direct insert with service key...');
  const { data, error } = await supabase
    .from('games')
    .insert(testGame)
    .select();

  if (error) {
    console.error('Insert failed:', error);
    console.log('\nThis indicates that Row Level Security is preventing inserts.');
    console.log('You need to either:');
    console.log('1. Use the Supabase dashboard to temporarily disable RLS on the games table');
    console.log('2. Update the RLS policies to allow service role inserts');
    console.log('3. Use the SQL editor in Supabase dashboard to run:');
    console.log('   ALTER TABLE games DISABLE ROW LEVEL SECURITY;');
    console.log('   (and re-enable it after import with: ALTER TABLE games ENABLE ROW LEVEL SECURITY;)');
    return false;
  } else {
    console.log('✓ Insert successful! Cleaning up test record...');
    
    // Clean up
    await supabase
      .from('games')
      .delete()
      .eq('bgg_id', 999998);
    
    console.log('✓ Database is ready for BGG imports');
    return true;
  }
}

disableRLSForImport()
  .then((success) => {
    if (success) {
      console.log('\n🎉 Database is ready for BGG imports!');
      console.log('You can now run: npm run fetch:bgg 25');
    } else {
      console.log('\n❌ Database needs manual RLS configuration before imports can proceed.');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
