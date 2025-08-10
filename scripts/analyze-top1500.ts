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

// Parse CSV data
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
      
      // Only include base games (not expansions) with valid ranks
      if (game.is_expansion === '0' && game.rank && game.rank > 0 && game.rank <= 1500) {
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

// Analyze top 1500 ranked games
async function analyzeTop1500Games() {
  console.log('🎯 Analyzing top 1500 BGG ranked games...');
  
  try {
    // Read the CSV file
    const csvPath = path.join(process.cwd(), 'data', 'boardgames_ranks.csv');
    if (!fs.existsSync(csvPath)) {
      throw new Error('boardgames_ranks.csv not found in data folder');
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    console.log('📄 Reading BGG rankings CSV...');
    
    // Parse CSV data
    const allGames = parseCSV(csvContent);
    console.log(`📋 Parsed ${allGames.length} base games from CSV`);
    
    // Get top 1500 games (filter for base games only, ranked 1-1500)
    const top1500Games = allGames.filter(game => game.rank <= 1500);
    console.log(`🏆 Found ${top1500Games.length} games in top 1500 (base games only)`);
    
    // Get existing games from database
    const existingIds = await getExistingGameIds();
    
    // Find missing games
    const missingGames: BGGRankingData[] = [];
    const existingGames: BGGRankingData[] = [];
    
    for (const game of top1500Games) {
      if (existingIds.has(game.id)) {
        existingGames.push(game);
      } else {
        missingGames.push(game);
      }
    }
    
    console.log(`\n📊 Top 1500 Analysis Results:`);
    console.log(`🏆 Total top 1500 games: ${top1500Games.length}`);
    console.log(`✅ Already in database: ${existingGames.length}`);
    console.log(`❌ Missing from database: ${missingGames.length}`);
    console.log(`📈 Database coverage: ${((existingGames.length / top1500Games.length) * 100).toFixed(1)}%`);
    
    if (missingGames.length === 0) {
      console.log('\n🎉 Congratulations! You have all top 1500 games in your database!');
      return;
    }
    
    // Show breakdown by rank ranges
    console.log(`\n📊 Missing games by rank range:`);
    const rankRanges = [
      { name: 'Top 10', min: 1, max: 10 },
      { name: 'Top 50', min: 1, max: 50 },
      { name: 'Top 100', min: 1, max: 100 },
      { name: 'Top 250', min: 1, max: 250 },
      { name: 'Top 500', min: 1, max: 500 },
      { name: 'Top 1000', min: 1, max: 1000 },
      { name: 'Top 1500', min: 1, max: 1500 }
    ];
    
    for (const range of rankRanges) {
      const rangeGames = top1500Games.filter(g => g.rank >= range.min && g.rank <= range.max);
      const rangeMissing = missingGames.filter(g => g.rank >= range.min && g.rank <= range.max);
      const coverage = ((rangeGames.length - rangeMissing.length) / rangeGames.length * 100).toFixed(1);
      console.log(`   ${range.name.padEnd(8)}: ${rangeMissing.length.toString().padStart(3)} missing / ${rangeGames.length.toString().padStart(4)} total (${coverage}% coverage)`);
    }
    
    // Save missing games data
    const missingGamesData = {
      total_missing: missingGames.length,
      total_top_1500: top1500Games.length,
      coverage_percentage: ((existingGames.length / top1500Games.length) * 100).toFixed(1),
      generated_at: new Date().toISOString(),
      source: 'BGG top 1500 ranked games (base games only)',
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
    
    fs.writeFileSync('missing-games.json', JSON.stringify(missingGamesData, null, 2));
    
    console.log(`\n💾 Saved detailed missing games data to missing-games.json`);
    console.log(`🎯 Missing games prioritized by BGG rank (best games first)`);
    
    // Show top 20 missing games
    console.log(`\n🏆 Top 20 highest-ranked missing games:`);
    const top20Missing = missingGames.slice(0, 20);
    for (const game of top20Missing) {
      const rating = parseFloat(game.average).toFixed(1);
      const votes = parseInt(game.usersrated).toLocaleString();
      console.log(`   #${game.rank.toString().padStart(4)} - ${game.name} (${game.yearpublished}) - ${rating}/10 (${votes} votes) - BGG ID: ${game.id}`);
    }
    
    if (missingGames.length > 20) {
      console.log(`   ... and ${missingGames.length - 20} more games`);
    }
    
    console.log(`\n🚀 Next steps:`);
    console.log(`1. Run "npm run import:careful" to import these ${missingGames.length} missing games`);
    console.log(`2. This will prioritize the highest-ranked games first`);
    console.log(`3. Your database will then have complete coverage of BGG's top ranked games!`);
    
  } catch (error) {
    console.error('❌ Error analyzing top 1500 games:', error);
    throw error;
  }
}

// Handle script execution
if (require.main === module) {
  analyzeTop1500Games()
    .then(() => {
      console.log('\n✅ Top 1500 analysis completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    });
}
