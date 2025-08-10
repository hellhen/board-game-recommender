import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { parseString } from 'xml2js';
import { promisify } from 'util';

// Load environment variables
dotenv.config({ path: '.env.local' });

const parseXML = promisify(parseString);

// Supabase setup
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

// Rate limiting helpers
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface BGGGameData {
  bgg_id: number;
  title: string;
  year_published: number;
  min_players: number;
  max_players: number;
  min_playtime: number;
  max_playtime: number;
  complexity: number;
  mechanics: string[];
  categories: string[];
  description: string;
  image_url: string;
  thumbnail_url: string;
  designers: string[];
  publishers: string[];
  rating: number;
  rank: number;
}

class BGGFetcher {
  private readonly baseUrl = 'https://boardgamegeek.com/xmlapi2';
  private readonly rateLimit = 2000; // 2 seconds between requests to be respectful

  async fetchGameById(id: number): Promise<BGGGameData | null> {
    try {
      console.log(`Fetching BGG game ID: ${id}`);
      
      const response = await axios.get(`${this.baseUrl}/thing`, {
        params: {
          id: id,
          type: 'boardgame',
          stats: 1
        },
        timeout: 10000
      });

      if (!response.data) {
        console.warn(`No data returned for game ID ${id}`);
        return null;
      }

      const parsed = await parseXML(response.data) as any;
      const item = parsed?.items?.item?.[0];
      
      if (!item) {
        console.warn(`No valid item found for game ID ${id}`);
        return null;
      }

      return this.parseGameData(item, id);
      
    } catch (error: any) {
      console.error(`Error fetching game ${id}:`, error.message);
      return null;
    }
  }

  async fetchTopGames(limit: number = 100): Promise<number[]> {
    try {
      console.log(`Fetching top ${limit} games from BGG...`);
      
      const response = await axios.get(`${this.baseUrl}/hot`, {
        params: {
          type: 'boardgame'
        },
        timeout: 10000
      });

      const parsed = await parseXML(response.data) as any;
      const items = parsed?.items?.item || [];
      
      const gameIds = items
        .slice(0, limit)
        .map((item: any) => parseInt(item.$.id))
        .filter((id: number) => !isNaN(id));

      console.log(`Found ${gameIds.length} game IDs from hot list`);
      return gameIds;
      
    } catch (error) {
      console.error('Error fetching hot games list:', error);
      return [];
    }
  }

  async fetchGamesByRank(startRank: number = 1, count: number = 100): Promise<number[]> {
    try {
      console.log(`Fetching games ranked ${startRank} to ${startRank + count - 1}`);
      
      // BGG doesn't have a direct "get games by rank" API, so we'll use a curated list
      // of popular game IDs that we know are high-quality
      const popularGameIds = [
        174430, // Gloomhaven
        161936, // Pandemic Legacy: Season 1
        182028, // Through the Ages: A New Story of Civilization
        12333,  // Twilight Struggle
        233078, // Twilight Imperium: Fourth Edition
        167791, // Terraforming Mars
        220308, // Gaia Project
        173346, // 7 Wonders Duel
        31260,  // Agricola
        68448,  // 7 Wonders
        120677, // Terra Mystica
        36218,  // Dominion
        193738, // Great Western Trail
        102794, // Caverna: The Cave Farmers
        28720,  // Brass: Birmingham
        28720,  // Brass: Lancashire
        266192, // Wings of Glory
        251882, // Brass: Birmingham
        28720,  // Puerto Rico
        13,     // Catan
        30549,  // Pandemic
        70323,  // King of Tokyo
        39856,  // Dixit
        98778,  // Hanabi
        42, 43, 44, 45, 46, // Classic games
        129622, // Love Letter
        131357, // Coup
        148228, // Splendor
        158899, // Azul
        205637, // Arkham Horror: The Card Game
        224517, // Brass: Birmingham (duplicate check)
        // Add more popular game IDs here
        174430, 161936, 182028, 12333, 233078, 167791, 220308, 173346,
        31260, 68448, 120677, 36218, 193738, 102794, 251882, 28720,
        13, 30549, 70323, 39856, 98778, 129622, 131357, 148228, 158899,
        205637, 169786, 266524, 169426, 164928, 145419, 163412, 190836,
        202408, 180263, 126163, 187645, 146021, 200146, 184267, 181304,
        266810, 230802, 137297, 194655, 183394, 245654, 256916, 283155,
        302260, 291572, 295770, 266507, 284083, 300531, 266830, 256382
      ];

      return popularGameIds.slice(startRank - 1, startRank - 1 + count);
      
    } catch (error) {
      console.error('Error creating ranked games list:', error);
      return [];
    }
  }

  private parseGameData(item: any, id: number): BGGGameData {
    // Helper to safely extract data
    const getValue = (obj: any, defaultValue: any = null) => {
      if (!obj) return defaultValue;
      if (Array.isArray(obj)) {
        return obj.length > 0 ? obj[0] : defaultValue;
      }
      return obj;
    };

    const getValueAttribute = (obj: any, attr: string = 'value', defaultValue: any = null) => {
      const val = getValue(obj);
      return val?.$?.[attr] ?? defaultValue;
    };

    // Extract basic info
    const name = item.name?.find((n: any) => n.$.type === 'primary') || item.name?.[0];
    const title = getValueAttribute(name, 'value', `Unknown Game ${id}`);
    
    const yearPublished = parseInt(getValueAttribute(item.yearpublished, 'value', '0'));
    const minPlayers = parseInt(getValueAttribute(item.minplayers, 'value', '1'));
    const maxPlayers = parseInt(getValueAttribute(item.maxplayers, 'value', '4'));
    const minPlaytime = parseInt(getValueAttribute(item.minplaytime, 'value', '30'));
    const maxPlaytime = parseInt(getValueAttribute(item.maxplaytime, 'value', '60'));
    
    // BGG weight is complexity
    const complexity = parseFloat(item.statistics?.[0]?.ratings?.[0]?.averageweight?.[0]?.$.value || '2.5');
    
    // Extract mechanics and categories
    const links = item.link || [];
    const mechanics = links
      .filter((link: any) => link.$.type === 'boardgamemechanic')
      .map((link: any) => this.normalizeMechanic(link.$.value))
      .slice(0, 5); // Limit to top 5 mechanics
    
    const categories = links
      .filter((link: any) => link.$.type === 'boardgamecategory')
      .map((link: any) => link.$.value)
      .slice(0, 3); // Limit to top 3 categories
    
    // Extract other data
    const description = getValue(item.description, '').replace(/<[^>]*>/g, '').slice(0, 500);
    const image = getValue(item.image, '');
    const thumbnail = getValue(item.thumbnail, '');
    
    const designers = links
      .filter((link: any) => link.$.type === 'boardgamedesigner')
      .map((link: any) => link.$.value);
    
    const publishers = links
      .filter((link: any) => link.$.type === 'boardgamepublisher')
      .map((link: any) => link.$.value)
      .slice(0, 3);
    
    const rating = parseFloat(item.statistics?.[0]?.ratings?.[0]?.average?.[0]?.$.value || '0');
    const rank = parseInt(item.statistics?.[0]?.ratings?.[0]?.ranks?.[0]?.rank?.find((r: any) => r.$.name === 'boardgame')?.$?.value || '999999');

    return {
      bgg_id: id,
      title,
      year_published: yearPublished,
      min_players: minPlayers,
      max_players: maxPlayers,
      min_playtime: minPlaytime,
      max_playtime: maxPlaytime,
      complexity: Math.round(complexity * 10) / 10, // Round to 1 decimal
      mechanics,
      categories,
      description,
      image_url: image,
      thumbnail_url: thumbnail,
      designers,
      publishers,
      rating: Math.round(rating * 10) / 10,
      rank: isNaN(rank) ? 999999 : rank
    };
  }

  private normalizeMechanic(mechanic: string): string {
    // Normalize BGG mechanics to our simplified format
    const mechanicMap: { [key: string]: string } = {
      'Tile Placement': 'tile-laying',
      'Set Collection': 'set-collection',
      'Pattern Building': 'pattern-building',
      'Area Control / Area Influence': 'area-control',
      'Worker Placement': 'worker-placement',
      'Hand Management': 'hand-management',
      'Drafting': 'drafting',
      'Engine Building': 'engine-building',
      'Deck, Bag, and Pool Building': 'deck-building',
      'Variable Player Powers': 'variable-powers',
      'Action Point Allowance System': 'action-points',
      'Simultaneous Action Selection': 'simultaneous-action',
      'Route/Network Building': 'route-building',
      'Trading': 'trading',
      'Auction/Bidding': 'auction'
    };

    return mechanicMap[mechanic] || mechanic.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }

  async delay(): Promise<void> {
    await delay(this.rateLimit);
  }
}

export async function expandDatabaseWithBGG(gameCount: number = 50): Promise<void> {
  console.log(`Starting BGG database expansion with ${gameCount} games...`);
  
  const fetcher = new BGGFetcher();
  let processedCount = 0;
  let insertedCount = 0;
  let skippedCount = 0;

  try {
    // Temporarily disable RLS for imports (requires service role)
    console.log('Setting up database permissions...');
    await supabase.rpc('exec', { 
      sql: 'ALTER TABLE games DISABLE ROW LEVEL SECURITY;' 
    });

    // Get a mix of popular games
    const hotGameIds = await fetcher.fetchTopGames(Math.floor(gameCount / 2));
    const rankedGameIds = await fetcher.fetchGamesByRank(1, Math.ceil(gameCount / 2));
    
    const allGameIds = [...new Set([...hotGameIds, ...rankedGameIds])].slice(0, gameCount);
    
    console.log(`Processing ${allGameIds.length} unique games...`);

    for (const gameId of allGameIds) {
      try {
        // Check if we already have this game
        const { data: existing } = await supabase
          .from('games')
          .select('id')
          .eq('bgg_id', gameId)
          .single();

        if (existing) {
          console.log(`Game ${gameId} already exists, skipping...`);
          skippedCount++;
          processedCount++;
          continue;
        }

        // Fetch game data from BGG
        const gameData = await fetcher.fetchGameById(gameId);
        
        if (!gameData) {
          console.warn(`Could not fetch data for game ${gameId}`);
          processedCount++;
          continue;
        }

        // Transform data for our database
        const dbGame = {
          title: gameData.title,
          bgg_id: gameData.bgg_id,
          players: `${gameData.min_players}–${gameData.max_players}${gameData.min_players === gameData.max_players ? '' : ` (best ${Math.ceil((gameData.min_players + gameData.max_players) / 2)})`}`,
          playtime: `${gameData.min_playtime}–${gameData.max_playtime} min`,
          complexity: gameData.complexity,
          mechanics: gameData.mechanics,
          theme: categorizeTheme(gameData.categories),
          tags: generateTags(gameData),
          description: gameData.description,
          image_url: gameData.image_url
        };

        // Insert into database (bypass RLS by using service role)
        const { error } = await supabase
          .from('games')
          .insert(dbGame);

        if (error) {
          console.error(`Error inserting game ${gameId}:`, error);
        } else {
          console.log(`✓ Inserted: ${gameData.title}`);
          insertedCount++;
        }

        processedCount++;
        
        // Rate limiting
        await fetcher.delay();
        
        // Progress update every 10 games
        if (processedCount % 10 === 0) {
          console.log(`Progress: ${processedCount}/${allGameIds.length} games processed (${insertedCount} inserted, ${skippedCount} skipped)`);
        }

      } catch (error) {
        console.error(`Error processing game ${gameId}:`, error);
        processedCount++;
      }
    }

    console.log(`\n🎉 BGG expansion completed!`);
    console.log(`Total processed: ${processedCount}`);
    console.log(`New games added: ${insertedCount}`);
    console.log(`Skipped (already existed): ${skippedCount}`);

  } catch (error) {
    console.error('BGG expansion failed:', error);
    throw error;
  } finally {
    // Re-enable RLS
    try {
      console.log('Restoring database security policies...');
      await supabase.rpc('exec', { 
        sql: 'ALTER TABLE games ENABLE ROW LEVEL SECURITY;' 
      });
    } catch (error) {
      console.warn('Warning: Could not restore RLS policies:', error);
    }
  }
}

function categorizeTheme(categories: string[]): string {
  // Simple theme categorization based on BGG categories
  const themeMap: { [key: string]: string } = {
    'Medieval': 'medieval',
    'Fantasy': 'fantasy',
    'Science Fiction': 'sci-fi',
    'Economic': 'economy',
    'Environmental': 'nature',
    'Animals': 'nature',
    'City Building': 'city-building',
    'Civilization': 'civilization',
    'War': 'war',
    'Pirates': 'adventure',
    'Space Exploration': 'space',
    'Transportation': 'transport',
    'Industry / Manufacturing': 'industry'
  };

  for (const category of categories) {
    if (themeMap[category]) {
      return themeMap[category];
    }
  }

  return 'strategy'; // Default theme
}

function generateTags(gameData: BGGGameData): string[] {
  const tags: string[] = [];

  // Complexity-based tags
  if (gameData.complexity <= 2.0) tags.push('family');
  if (gameData.complexity <= 1.5) tags.push('light');
  if (gameData.complexity >= 3.5) tags.push('heavy');
  if (gameData.complexity >= 4.0) tags.push('expert');

  // Player count tags
  if (gameData.max_players >= 6) tags.push('party');
  if (gameData.max_players <= 2) tags.push('two-player');
  if (gameData.min_players === 1) tags.push('solo');

  // Playtime tags
  if (gameData.max_playtime <= 30) tags.push('quick');
  if (gameData.max_playtime >= 120) tags.push('long');

  // Rating-based tags
  if (gameData.rating >= 7.5) tags.push('highly-rated');
  if (gameData.rank <= 100) tags.push('top-rated');

  // Mechanic-based tags
  if (gameData.mechanics.includes('engine-building')) tags.push('satisfying');
  if (gameData.mechanics.includes('area-control')) tags.push('competitive');
  if (gameData.mechanics.includes('cooperative')) tags.push('coop');

  return tags.slice(0, 5); // Limit to 5 tags
}

// CLI execution
if (require.main === module) {
  const gameCount = parseInt(process.argv[2]) || 50;
  
  expandDatabaseWithBGG(gameCount)
    .then(() => {
      console.log('BGG expansion script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('BGG expansion script failed:', error);
      process.exit(1);
    });
}
