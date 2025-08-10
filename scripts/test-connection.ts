import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function testSupabaseConnection() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl ? 'Present' : 'Missing');
  console.log('Service Key:', supabaseServiceKey ? `Present (${supabaseServiceKey.slice(0, 20)}...)` : 'Missing');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    // Test basic connection
    const { data, error } = await supabase.from('games').select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Connection error:', error);
    } else {
      console.log('✓ Connection successful');
      console.log('Current game count:', data);
    }

    // Test insert capability with a dummy record
    const testGame = {
      title: 'Test Game - DELETE ME',
      bgg_id: 999999,
      players: '2-4',
      playtime: '30 min',
      complexity: 2.5,
      mechanics: ['test'],
      theme: 'test',
      tags: ['test'],
      description: 'This is a test game that should be deleted'
    };

    const { data: insertData, error: insertError } = await supabase
      .from('games')
      .insert(testGame)
      .select();

    if (insertError) {
      console.error('Insert error:', insertError);
    } else {
      console.log('✓ Insert successful');
      
      // Clean up the test record
      const { error: deleteError } = await supabase
        .from('games')
        .delete()
        .eq('bgg_id', 999999);
      
      if (deleteError) {
        console.error('Delete error:', deleteError);
      } else {
        console.log('✓ Cleanup successful');
      }
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testSupabaseConnection()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
