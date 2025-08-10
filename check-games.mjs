import { supabase } from './lib/supabase.js';

async function checkGames() {
  console.log('Checking for Targi...');
  const { data: targi, error: targiError } = await supabase
    .from('games')
    .select('*')
    .ilike('title', '%targi%');
  
  if (targiError) {
    console.error('Targi error:', targiError);
  } else {
    console.log('Targi games found:', targi?.length || 0);
    targi?.forEach(game => console.log(`  - "${game.title}" (ID: ${game.id})`));
  }
  
  console.log('\nChecking for Patchwork...');
  const { data: patchwork, error: patchworkError } = await supabase
    .from('games')
    .select('*')
    .ilike('title', '%patchwork%');
  
  if (patchworkError) {
    console.error('Patchwork error:', patchworkError);
  } else {
    console.log('Patchwork games found:', patchwork?.length || 0);
    patchwork?.forEach(game => console.log(`  - "${game.title}" (ID: ${game.id})`));
  }
  
  process.exit(0);
}

checkGames();
