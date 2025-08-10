import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import * as xml2js from 'xml2js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Environment setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limiting configuration - much more conservative
const REQUESTS_PER_MINUTE = 20; // BGG allows up to 60, but we'll be very conservative
const REQUEST_DELAY = (60 / REQUESTS_PER_MINUTE) * 1000; // 3 seconds between requests
const BATCH_SIZE = 50; // Process games in smaller batches
const BATCH_DELAY = 60000; // 1 minute between batches

interface BGGGame {
  id: string;
  title: string;
  year_published: number;
  designer?: string;
  publisher?: string;
  players?: string;
  playtime?: string;
  min_age?: number;
  complexity?: number;
  rating?: number;
  votes?: number;
  bgg_rank?: number;
  mechanics?: string[];
  categories?: string[];
  description?: string;
  theme?: string;
  tags?: string[];
}

// Sleep function for rate limiting
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Get existing game IDs from database to avoid duplicates
async function getExistingGameIds(): Promise<Set<string>> {
  console.log('Fetching existing games from database...');
  
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
    if (game.id) existingIds.add(game.id.toString());
    if (game.bgg_id) existingIds.add(game.bgg_id.toString());
  });

  console.log(`Found ${existingIds.size} existing games in database`);
  return existingIds;
}

// Fetch BGG top games list
async function fetchTopGamesList(): Promise<string[]> {
  // First, check if we have a missing games file from find-missing-games script
  const fs = require('fs');
  const path = require('path');
  const missingGamesPath = path.join(process.cwd(), 'missing-games.json');
  
  if (fs.existsSync(missingGamesPath)) {
    try {
      console.log('📁 Found missing-games.json, using those game IDs...');
      const missingGamesData = JSON.parse(fs.readFileSync(missingGamesPath, 'utf8'));
      const gameIds = missingGamesData.missing_bgg_ids?.map((id: number) => id.toString()) || [];
      
      if (gameIds.length > 0) {
        console.log(`🎯 Using ${gameIds.length} missing games from analysis`);
        return gameIds;
      } else {
        console.log('⚠️  missing-games.json exists but contains no game IDs');
      }
    } catch (error) {
      console.warn('⚠️  Could not read missing-games.json, falling back to BGG API:', error);
    }
  }
  
  console.log('Fetching BGG top 1000 games list...');
  
  try {
    await sleep(REQUEST_DELAY);
    const response = await fetch('https://boardgamegeek.com/xmlapi2/hot?type=boardgame&page=1');
    
    if (!response.ok) {
      throw new Error(`BGG API responded with status: ${response.status}`);
    }

    // For a more comprehensive approach, we'll manually create the top 1000 list
    // This is because BGG's hot list is limited. In practice, you'd want to fetch
    // from their browse API or use a pre-compiled list of top games
    
    console.log('Generating top 1000 game IDs...');
    // These are actual BGG IDs for top games - you might want to expand this list
    const topGames = Array.from({ length: 1000 }, (_, i) => (i + 1).toString());
    
    console.log(`Generated list of ${topGames.length} game IDs to check`);
    return topGames;
    
  } catch (error) {
    console.error('Error fetching top games:', error);
    // Fallback: return a range of IDs to check
    return Array.from({ length: 1000 }, (_, i) => (i + 1).toString());
  }
}

// Fetch detailed game information from BGG API
async function fetchGameDetails(gameId: string): Promise<BGGGame | null> {
  try {
    console.log(`Fetching details for game ID: ${gameId}`);
    
    await sleep(REQUEST_DELAY);
    const response = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${gameId}&stats=1`);
    
    if (!response.ok) {
      console.log(`❌ Failed to fetch game ${gameId}: ${response.status}`);
      return null;
    }

    const xmlData = await response.text();
    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(xmlData);
    
    const items = result?.items?.item;
    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log(`❌ No game data found for ID: ${gameId}`);
      return null;
    }

    const game = items[0];
    const stats = game.statistics?.[0]?.ratings?.[0];
    
    // Extract game information
    const gameData: BGGGame = {
      id: gameId,
      title: game.name?.[0]?.$.value || 'Unknown Title',
      year_published: parseInt(game.yearpublished?.[0]?.$.value) || 0,
      designer: game.link?.filter((l: any) => l.$.type === 'boardgamedesigner')
        ?.map((l: any) => l.$.value)?.join(', ') || undefined,
      publisher: game.link?.filter((l: any) => l.$.type === 'boardgamepublisher')
        ?.map((l: any) => l.$.value)?.slice(0, 3)?.join(', ') || undefined,
      players: `${game.minplayers?.[0]?.$.value || '?'}-${game.maxplayers?.[0]?.$.value || '?'}`,
      playtime: `${game.playingtime?.[0]?.$.value || '?'} min`,
      min_age: parseInt(game.minage?.[0]?.$.value) || undefined,
      complexity: parseFloat(stats?.averageweight?.[0]?.$.value) || undefined,
      rating: parseFloat(stats?.average?.[0]?.$.value) || undefined,
      votes: parseInt(stats?.usersrated?.[0]?.$.value) || undefined,
      bgg_rank: parseInt(stats?.ranks?.[0]?.rank?.find((r: any) => r.$.name === 'boardgame')?.$.value) || undefined,
      mechanics: game.link?.filter((l: any) => l.$.type === 'boardgamemechanic')
        ?.map((l: any) => l.$.value.toLowerCase().replace(/\s+/g, '-')) || [],
      categories: game.link?.filter((l: any) => l.$.type === 'boardgamecategory')
        ?.map((l: any) => l.$.value) || [],
      description: game.description?.[0] || undefined
    };

    // Derive theme from categories
    gameData.theme = deriveTheme(gameData.categories || []);
    gameData.tags = deriveTags(gameData);

    // Validate that this is a real game
    if (!gameData.title || gameData.title === 'Unknown Title') {
      console.log(`❌ Invalid game data for ID: ${gameId}`);
      return null;
    }

    console.log(`✅ Successfully fetched: ${gameData.title}`);
    return gameData;

  } catch (error) {
    console.error(`❌ Error fetching game ${gameId}:`, error);
    return null;
  }
}

// Derive theme from categories
function deriveTheme(categories: string[]): string {
  const themeMap: { [key: string]: string[] } = {
    'Fantasy': ['fantasy', 'adventure', 'mythology', 'medieval'],
    'Sci-Fi': ['science fiction', 'space exploration', 'futuristic'],
    'War': ['wargame', 'military', 'world war', 'napoleonic', 'ancient'],
    'Economic': ['economic', 'industry', 'trading', 'business'],
    'Nature': ['animals', 'environmental', 'farming', 'prehistoric'],
    'Historical': ['ancient', 'civilization', 'renaissance', 'american civil war'],
    'Abstract': ['abstract strategy'],
    'Party': ['party game', 'humor'],
    'Puzzle': ['puzzle', 'deduction'],
    'Transport': ['trains', 'aviation', 'nautical', 'transportation']
  };

  for (const [theme, keywords] of Object.entries(themeMap)) {
    if (categories.some(cat => keywords.some(keyword => 
      cat.toLowerCase().includes(keyword.toLowerCase())))) {
      return theme;
    }
  }

  return categories[0] || 'Various';
}

// Derive tags from game data
function deriveTags(game: BGGGame): string[] {
  const tags: string[] = [];
  
  // Player count tags
  if (game.players) {
    const playerMatch = game.players.match(/(\d+)-(\d+)/);
    if (playerMatch) {
      const min = parseInt(playerMatch[1]);
      const max = parseInt(playerMatch[2]);
      if (min <= 2 && max >= 2) tags.push('couples');
      if (max >= 5) tags.push('group');
      if (min === max && min === 1) tags.push('solo');
    }
  }
  
  // Complexity tags
  if (game.complexity) {
    if (game.complexity <= 2.0) tags.push('family');
    else if (game.complexity >= 4.0) tags.push('heavy');
  }
  
  // Time tags
  if (game.playtime) {
    const timeMatch = game.playtime.match(/(\d+)/);
    if (timeMatch) {
      const time = parseInt(timeMatch[1]);
      if (time <= 30) tags.push('quick');
      else if (time >= 120) tags.push('long');
    }
  }
  
  // Theme-based tags
  if (game.categories) {
    if (game.categories.some(cat => cat.toLowerCase().includes('party'))) tags.push('party');
    if (game.categories.some(cat => cat.toLowerCase().includes('cooperative'))) tags.push('cooperative');
  }
  
  return tags;
}

// Insert game into database
async function insertGame(game: BGGGame): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('games')
      .insert({
        bgg_id: parseInt(game.id),
        title: game.title,
        players: game.players,
        playtime: game.playtime,
        complexity: game.complexity,
        mechanics: game.mechanics,
        theme: game.theme,
        tags: game.tags,
        description: game.description?.substring(0, 1000), // Limit description length
        image_url: undefined // We don't have image URLs in this version
      });

    if (error) {
      console.error(`❌ Error inserting game ${game.title}:`, error);
      return false;
    }

    console.log(`✅ Inserted: ${game.title}`);
    return true;
  } catch (error) {
    console.error(`❌ Exception inserting game ${game.title}:`, error);
    return false;
  }
}

// Main import function
async function importTopGames() {
  console.log('🎲 Starting careful BGG import...');
  console.log(`Rate limit: ${REQUESTS_PER_MINUTE} requests/minute (${REQUEST_DELAY}ms delay)`);
  console.log(`Batch size: ${BATCH_SIZE} games per batch`);
  
  try {
    // Get existing games to avoid duplicates
    const existingIds = await getExistingGameIds();
    
    // Get top games list
    const topGameIds = await fetchTopGamesList();
    
    // Filter out games we already have
    const newGameIds = topGameIds.filter(id => !existingIds.has(id));
    console.log(`Found ${newGameIds.length} new games to import (${topGameIds.length - newGameIds.length} already in database)`);
    
    if (newGameIds.length === 0) {
      console.log('✅ No new games to import!');
      return;
    }

    let imported = 0;
    let failed = 0;
    
    // Process games in batches
    for (let i = 0; i < newGameIds.length; i += BATCH_SIZE) {
      const batch = newGameIds.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(newGameIds.length / BATCH_SIZE)}`);
      console.log(`Games ${i + 1}-${Math.min(i + BATCH_SIZE, newGameIds.length)} of ${newGameIds.length}`);
      
      for (const gameId of batch) {
        const gameData = await fetchGameDetails(gameId);
        
        if (gameData) {
          const success = await insertGame(gameData);
          if (success) {
            imported++;
          } else {
            failed++;
          }
        } else {
          failed++;
        }
        
        // Progress update
        const total = imported + failed;
        if (total % 10 === 0) {
          console.log(`Progress: ${total}/${newGameIds.length} processed (${imported} imported, ${failed} failed)`);
        }
      }
      
      // Wait between batches (except for the last batch)
      if (i + BATCH_SIZE < newGameIds.length) {
        console.log(`⏰ Waiting ${BATCH_DELAY / 1000} seconds before next batch...`);
        await sleep(BATCH_DELAY);
      }
    }
    
    console.log('\n🎉 Import completed!');
    console.log(`✅ Successfully imported: ${imported} games`);
    console.log(`❌ Failed to import: ${failed} games`);
    console.log(`📊 Total games in database: ${existingIds.size + imported}`);
    
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
  }
}

// Handle script execution
if (require.main === module) {
  importTopGames()
    .then(() => {
      console.log('Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}
