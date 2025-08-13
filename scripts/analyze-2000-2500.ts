import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface BGGRankingData {
  id: string;
  name: string;
  yearpublished: string;
  rank: number;
  bayesaverage: string;
  average: string;
  usersrated: string;
  is_expansion: string;
}

// Parse CSV data for games ranked 2000-2500
function parseCSV(csvContent: string): BGGRankingData[] {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  
  const games: BGGRankingData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Simple CSV parsing (this assumes no commas in game names beyond the quotes)
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current); // Add the last value
    
    if (values.length >= 8) {
      const game: BGGRankingData = {
        id: values[0],
        name: values[1].replace(/"/g, ''), // Remove quotes from name
        yearpublished: values[2],
        rank: parseInt(values[3]),
        bayesaverage: values[4],
        average: values[5],
        usersrated: values[6],
        is_expansion: values[7]
      };
      
      // Only include base games (not expansions) with valid ranks between 2000-2500
      if (game.is_expansion === '0' && game.rank && game.rank > 2000 && game.rank <= 2500) {
        games.push(game);
      }
    }
  }
  
  return games.sort((a, b) => a.rank - b.rank);
}

// Get existing game IDs from database
async function getExistingGameIds(): Promise<Set<string>> {
  console.log('📊 Fetching existing games from database...');
  
  const { data, error } = await supabase
    .from('games')
    .select('id, bgg_id')
    .order('id');

  if (error) {
    console.error('Error fetching existing games:', error);
    return new Set();
  }

  const existingIds = new Set<string>();
  data?.forEach(game => {
    // Add both regular ID and BGG ID to the set
    if (game.id) existingIds.add(game.id.toString());
    if (game.bgg_id) existingIds.add(game.bgg_id.toString());
  });

  console.log(`✅ Found ${existingIds.size} existing games in database`);
  return existingIds;
}

// Analyze games ranked 2000-2500
async function analyze2000to2500Games() {
  console.log('🎯 Analyzing BGG ranked games 2000-2500...');
  
  try {
    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'data', 'boardgames_ranks.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error('boardgames_ranks.csv not found in data folder');
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    console.log('📄 Reading BGG rankings CSV...');
    
    // Parse CSV data for games 2000-2500
    const allGames = parseCSV(csvContent);
    console.log(`📋 Parsed ${allGames.length} base games from CSV (rank 2000-2500)`);
    
    if (allGames.length === 0) {
      console.log('❌ No games found in the 2000-2500 rank range. Check your CSV data.');
      return;
    }
    
    // Get existing games from database
    const existingIds = await getExistingGameIds();
    
    // Find missing games
    const missingGames: BGGRankingData[] = [];
    const existingGames: BGGRankingData[] = [];
    
    for (const game of allGames) {
      if (existingIds.has(game.id)) {
        existingGames.push(game);
      } else {
        missingGames.push(game);
      }
    }
    
    console.log(`\n📊 Games 2000-2500 Analysis Results:`);
    console.log(`🏆 Total games in range 2000-2500: ${allGames.length}`);
    console.log(`✅ Already in database: ${existingGames.length}`);
    console.log(`❌ Missing from database: ${missingGames.length}`);
    console.log(`📈 Database coverage: ${((existingGames.length / allGames.length) * 100).toFixed(1)}%`);
    
    if (missingGames.length === 0) {
      console.log('\n🎉 Congratulations! You have all games ranked 2000-2500 in your database!');
      return;
    }
    
    // Show breakdown by rank ranges within 2000-2500
    console.log(`\n📊 Missing games by rank range:`);
    const rankRanges = [
      { name: '2001-2100', min: 2001, max: 2100 },
      { name: '2101-2200', min: 2101, max: 2200 },
      { name: '2201-2300', min: 2201, max: 2300 },
      { name: '2301-2400', min: 2301, max: 2400 },
      { name: '2401-2500', min: 2401, max: 2500 }
    ];
    
    for (const range of rankRanges) {
      const rangeGames = allGames.filter(g => g.rank >= range.min && g.rank <= range.max);
      const rangeMissing = missingGames.filter(g => g.rank >= range.min && g.rank <= range.max);
      const coverage = rangeGames.length > 0 ? ((rangeGames.length - rangeMissing.length) / rangeGames.length * 100).toFixed(1) : '0.0';
      console.log(`   ${range.name.padEnd(9)}: ${rangeMissing.length.toString().padStart(3)} missing / ${rangeGames.length.toString().padStart(4)} total (${coverage}% coverage)`);
    }
    
    // Save missing games data
    const missingGamesData = {
      total_missing: missingGames.length,
      total_in_range: allGames.length,
      coverage_percentage: ((existingGames.length / allGames.length) * 100).toFixed(1),
      generated_at: new Date().toISOString(),
      rank_range: '2000-2500',
      source: 'BGG ranked games 2000-2500 (base games only)',
      missing_games: missingGames.map(game => ({
        bgg_id: parseInt(game.id),
        rank: game.rank,
        name: game.name,
        year: parseInt(game.yearpublished) || null,
        rating: parseFloat(game.average) || null,
        votes: parseInt(game.usersrated) || null
      })),
      missing_bgg_ids: missingGames.map(game => parseInt(game.id))
    };
    
    fs.writeFileSync('missing-games-2000-2500.json', JSON.stringify(missingGamesData, null, 2));
    
    console.log(`\n💾 Saved detailed missing games data to missing-games-2000-2500.json`);
    console.log(`🎯 Missing games prioritized by BGG rank (best games in range first)`);
    
    // Show top 20 missing games in this range
    console.log(`\n🏆 Top 20 highest-ranked missing games (2000-2500):`);
    const top20Missing = missingGames.slice(0, 20);
    for (const game of top20Missing) {
      const rating = parseFloat(game.average).toFixed(1);
      const votes = parseInt(game.usersrated).toLocaleString();
      console.log(`   #${game.rank.toString().padStart(4)} - ${game.name} (${game.yearpublished}) - ${rating}/10 (${votes} votes) - BGG ID: ${game.id}`);
    }
    
    if (missingGames.length > 20) {
      console.log(`   ... and ${missingGames.length - 20} more games`);
    }
    
    // Show some games you already have in this range
    if (existingGames.length > 0) {
      console.log(`\n✅ Sample of games you already have in 2000-2500 range:`);
      const sampleExisting = existingGames.slice(0, 10);
      for (const game of sampleExisting) {
        const rating = parseFloat(game.average).toFixed(1);
        const votes = parseInt(game.usersrated).toLocaleString();
        console.log(`   #${game.rank.toString().padStart(4)} - ${game.name} (${game.yearpublished}) - ${rating}/10 (${votes} votes) - BGG ID: ${game.id}`);
      }
      
      if (existingGames.length > 10) {
        console.log(`   ... and ${existingGames.length - 10} more existing games`);
      }
    }
    
    console.log(`\n🚀 Next steps:`);
    console.log(`1. Review the missing-games-2000-2500.json file`);
    console.log(`2. Run import script if you want to add these ${missingGames.length} games to your database`);
    console.log(`3. These games ranked 2000-2500 are still solid games worth having!`);
    
  } catch (error) {
    console.error('❌ Error analyzing games 2000-2500:', error);
    throw error;
  }
}

// Handle script execution
if (require.main === module) {
  analyze2000to2500Games()
    .then(() => {
      console.log('\n✅ Games 2000-2500 analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}
