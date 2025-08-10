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

interface GameUpdate {
  id: string;
  title: string;
  bgg_id?: number;
  description?: string;
  image_url?: string;
  complexity?: number;
  mechanics?: string[];
  tags?: string[];
  theme?: string;
}

class BGGGameUpdater {
  private readonly baseUrl = 'https://boardgamegeek.com/xmlapi2';
  private readonly rateLimit = 2000; // 2 seconds between requests

  async searchGameByTitle(title: string): Promise<number | null> {
    try {
      console.log(`🔍 Searching BGG for: "${title}"`);
      
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          query: title,
          type: 'boardgame',
          exact: 1 // Try exact match first
        },
        timeout: 10000
      });

      const parsed = await parseXML(response.data) as any;
      const items = parsed?.items?.item || [];
      
      if (items.length > 0) {
        const gameId = parseInt(items[0].$.id);
        console.log(`✓ Found BGG ID ${gameId} for "${title}"`);
        return gameId;
      }

      // If exact match fails, try fuzzy search
      const fuzzyResponse = await axios.get(`${this.baseUrl}/search`, {
        params: {
          query: title,
          type: 'boardgame'
        },
        timeout: 10000
      });

      const fuzzyParsed = await parseXML(fuzzyResponse.data) as any;
      const fuzzyItems = fuzzyParsed?.items?.item || [];
      
      if (fuzzyItems.length > 0) {
        // Take the first result from fuzzy search
        const gameId = parseInt(fuzzyItems[0].$.id);
        console.log(`~ Found BGG ID ${gameId} for "${title}" (fuzzy match)`);
        return gameId;
      }

      console.log(`❌ No BGG match found for "${title}"`);
      return null;
      
    } catch (error: any) {
      console.error(`Error searching for "${title}":`, error.message);
      return null;
    }
  }

  async fetchGameDetails(gameId: number): Promise<Partial<GameUpdate> | null> {
    try {
      const response = await axios.get(`${this.baseUrl}/thing`, {
        params: {
          id: gameId,
          type: 'boardgame',
          stats: 1
        },
        timeout: 10000
      });

      const parsed = await parseXML(response.data) as any;
      const item = parsed?.items?.item?.[0];
      
      if (!item) return null;

      // Extract data similar to the main fetch script
      const getValue = (obj: any, defaultValue: any = null) => {
        if (!obj) return defaultValue;
        if (Array.isArray(obj)) return obj.length > 0 ? obj[0] : defaultValue;
        return obj;
      };

      const getValueAttribute = (obj: any, attr: string = 'value', defaultValue: any = null) => {
        const val = getValue(obj);
        return val?.$?.[attr] ?? defaultValue;
      };

      // Extract complexity
      const complexity = parseFloat(item.statistics?.[0]?.ratings?.[0]?.averageweight?.[0]?.$.value || '0');

      // Extract mechanics and categories
      const links = item.link || [];
      const mechanics = links
        .filter((link: any) => link.$.type === 'boardgamemechanic')
        .map((link: any) => this.normalizeMechanic(link.$.value))
        .slice(0, 5);

      const categories = links
        .filter((link: any) => link.$.type === 'boardgamecategory')
        .map((link: any) => link.$.value)
        .slice(0, 3);

      // Extract other data
      const description = getValue(item.description, '').replace(/<[^>]*>/g, '').slice(0, 500);
      const image = getValue(item.image, '');

      return {
        bgg_id: gameId,
        description: description || undefined,
        image_url: image || undefined,
        complexity: complexity > 0 ? Math.round(complexity * 10) / 10 : undefined,
        mechanics: mechanics.length > 0 ? mechanics : undefined,
        theme: this.categorizeTheme(categories),
        tags: this.generateTags(complexity, mechanics, categories)
      };

    } catch (error: any) {
      console.error(`Error fetching game ${gameId}:`, error.message);
      return null;
    }
  }

  private normalizeMechanic(mechanic: string): string {
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

  private categorizeTheme(categories: string[]): string | undefined {
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

    return undefined; // Keep existing theme if no match
  }

  private generateTags(complexity: number, mechanics: string[], categories: string[]): string[] | undefined {
    const tags: string[] = [];

    // Complexity-based tags
    if (complexity <= 2.0) tags.push('family');
    if (complexity <= 1.5) tags.push('light');
    if (complexity >= 3.5) tags.push('heavy');
    if (complexity >= 4.0) tags.push('expert');

    // Mechanic-based tags
    if (mechanics.includes('engine-building')) tags.push('satisfying');
    if (mechanics.includes('area-control')) tags.push('competitive');
    if (mechanics.includes('cooperative')) tags.push('coop');

    // Category-based tags
    if (categories.some(c => c.includes('Party'))) tags.push('party');

    return tags.length > 0 ? tags.slice(0, 5) : undefined;
  }

  async delay(): Promise<void> {
    await delay(this.rateLimit);
  }
}

export async function updateExistingGamesWithBGG(): Promise<void> {
  console.log('🔄 Starting BGG metadata update for existing games...\n');

  const updater = new BGGGameUpdater();
  let processedCount = 0;
  let updatedCount = 0;
  let notFoundCount = 0;

  try {
    // Get games that don't have BGG data or are missing key metadata
    const { data: gamesNeedingUpdate, error } = await supabase
      .from('games')
      .select('id, title, bgg_id, description, image_url, complexity')
      .or('bgg_id.is.null,description.is.null,image_url.is.null,complexity.is.null')
      .order('title');

    if (error) {
      throw new Error(`Failed to fetch games: ${error.message}`);
    }

    if (!gamesNeedingUpdate || gamesNeedingUpdate.length === 0) {
      console.log('✅ All games already have complete BGG metadata!');
      return;
    }

    console.log(`Found ${gamesNeedingUpdate.length} games that could use BGG metadata updates:\n`);

    for (const game of gamesNeedingUpdate) {
      try {
        console.log(`Processing "${game.title}"...`);
        let gameId = game.bgg_id;

        // If no BGG ID, search for it
        if (!gameId) {
          gameId = await updater.searchGameByTitle(game.title);
          await updater.delay();
        }

        if (!gameId) {
          console.log(`❌ Could not find BGG data for "${game.title}"`);
          notFoundCount++;
          processedCount++;
          continue;
        }

        // Fetch game details from BGG
        const gameDetails = await updater.fetchGameDetails(gameId);
        await updater.delay();

        if (!gameDetails) {
          console.log(`❌ Could not fetch BGG details for "${game.title}"`);
          notFoundCount++;
          processedCount++;
          continue;
        }

        // Prepare update object (only update fields that are missing or null)
        const updateData: any = {};
        
        if (!game.bgg_id && gameDetails.bgg_id) updateData.bgg_id = gameDetails.bgg_id;
        if (!game.description && gameDetails.description) updateData.description = gameDetails.description;
        if (!game.image_url && gameDetails.image_url) updateData.image_url = gameDetails.image_url;
        if (!game.complexity && gameDetails.complexity) updateData.complexity = gameDetails.complexity;
        if (gameDetails.mechanics) updateData.mechanics = gameDetails.mechanics;
        if (gameDetails.tags) updateData.tags = gameDetails.tags;
        if (gameDetails.theme) updateData.theme = gameDetails.theme;

        // Only update if we have something to update
        if (Object.keys(updateData).length === 0) {
          console.log(`⏭️  "${game.title}" already has all available metadata`);
          processedCount++;
          continue;
        }

        // Update the game
        const { error: updateError } = await supabase
          .from('games')
          .update(updateData)
          .eq('id', game.id);

        if (updateError) {
          console.error(`❌ Error updating "${game.title}":`, updateError);
        } else {
          console.log(`✅ Updated "${game.title}" with BGG metadata`);
          updatedCount++;
        }

        processedCount++;

        // Progress update
        if (processedCount % 5 === 0) {
          console.log(`\nProgress: ${processedCount}/${gamesNeedingUpdate.length} games processed (${updatedCount} updated, ${notFoundCount} not found)\n`);
        }

      } catch (error) {
        console.error(`Error processing "${game.title}":`, error);
        processedCount++;
      }
    }

    console.log(`\n🎉 BGG metadata update completed!`);
    console.log(`Total processed: ${processedCount}`);
    console.log(`Games updated: ${updatedCount}`);
    console.log(`Games not found on BGG: ${notFoundCount}`);

  } catch (error) {
    console.error('BGG metadata update failed:', error);
    throw error;
  }
}

// CLI execution
if (require.main === module) {
  updateExistingGamesWithBGG()
    .then(() => {
      console.log('BGG metadata update completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('BGG metadata update failed:', error);
      process.exit(1);
    });
}
