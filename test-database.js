const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testDatabase() {
  console.log('Testing database queries...');
  
  // Test 1: Default query (no limit)
  console.log('\n1. Testing default query (no limit):');
  const { data: defaultData, error: defaultError } = await supabase
    .from('games')
    .select('*')
    .order('title');
  
  if (defaultError) {
    console.error('Default query error:', defaultError);
  } else {
    console.log(`Default query returned: ${defaultData?.length || 0} games`);
  }
  
  // Test 2: Query with limit 10000
  console.log('\n2. Testing query with limit 10000:');
  const { data: limitedData, error: limitedError } = await supabase
    .from('games')
    .select('*')
    .order('title')
    .limit(10000);
  
  if (limitedError) {
    console.error('Limited query error:', limitedError);
  } else {
    console.log(`Limited query returned: ${limitedData?.length || 0} games`);
  }
  
  // Test 3: Count total games
  console.log('\n3. Testing count query:');
  const { count, error: countError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Count query error:', countError);
  } else {
    console.log(`Total games in database: ${count}`);
  }
  
  // Test 4: Check for specific games
  console.log('\n4. Testing specific game queries:');
  const testGames = ['Patchwork', 'Targi', 'Wingspan'];
  
  for (const gameName of testGames) {
    const { data: gameData, error: gameError } = await supabase
      .from('games')
      .select('*')
      .ilike('title', `%${gameName}%`);
    
    if (gameError) {
      console.error(`${gameName} query error:`, gameError);
    } else {
      console.log(`${gameName}: Found ${gameData?.length || 0} games`);
      if (gameData && gameData.length > 0) {
        gameData.forEach(game => console.log(`  - "${game.title}"`));
      }
    }
  }
}

testDatabase().catch(console.error);
