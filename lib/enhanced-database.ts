import { supabase } from './supabase';
import type { Game } from './supabase';

// Enhanced database functions for more accurate recommendations

/**
 * Get games that have specific mechanics
 */
export async function getGamesByMechanics(mechanics: string[], limit: number = 50): Promise<Game[]> {
  console.log('🔍 Searching for games with mechanics:', mechanics);
  
  if (!supabase) {
    console.warn('⚠️ Supabase not available in getGamesByMechanics');
    return [];
  }
  
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .overlaps('mechanics', mechanics)
    .order('title')
    .limit(limit);
  
  if (error) {
    console.error('Error fetching games by mechanics:', error);
    return [];
  }
  
  // Filter to games that have ALL requested mechanics (if multiple)
  const filteredGames = data?.filter(game => 
    mechanics.every(mechanic => 
      game.mechanics?.includes(mechanic)
    )
  ) || [];
  
  console.log(`🔍 Found ${filteredGames.length} games with required mechanics`);
  return filteredGames;
}

/**
 * Get games that have any of the specified mechanics
 */
export async function getGamesByAnyMechanic(mechanics: string[], limit: number = 100): Promise<Game[]> {
  console.log('🔍 Searching for games with any of these mechanics:', mechanics);
  
  if (!supabase) {
    console.warn('⚠️ Supabase not available in getGamesByAnyMechanic');
    return [];
  }
  
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .overlaps('mechanics', mechanics)
    .order('title')
    .limit(limit);
  
  if (error) {
    console.error('Error fetching games by any mechanic:', error);
    return [];
  }
  
  console.log(`🔍 Found ${data?.length || 0} games with any of the requested mechanics`);
  return data || [];
}

/**
 * Get all unique mechanics in the database
 */
export async function getAllMechanics(): Promise<string[]> {
  if (!supabase) {
    console.warn('⚠️ Supabase not available in getAllMechanics');
    return [];
  }

  const { data, error } = await supabase
    .from('games')
    .select('mechanics');
  
  if (error) {
    console.error('Error fetching mechanics:', error);
    return [];
  }
  
  const allMechanics = new Set<string>();
  data?.forEach(game => {
    game.mechanics?.forEach((mechanic: string) => {
      allMechanics.add(mechanic);
    });
  });
  
  return Array.from(allMechanics).sort();
}

/**
 * Smart game search that considers user intent and available mechanics
 */
export async function intelligentGameSearch(userPrompt: string, limit: number = 50): Promise<{
  games: Game[];
  availableMechanics: string[];
  requestedMechanics: string[];
  matchType: 'exact' | 'partial' | 'broad';
}> {
  console.log('🧠 Intelligent search for:', userPrompt);
  
  // Get all available mechanics first
  const availableMechanics = await getAllMechanics();
  console.log('📋 Available mechanics in database:', availableMechanics.length);
  
  // Extract potential mechanics from user prompt
  const prompt = userPrompt.toLowerCase();
  const requestedMechanics: string[] = [];
  
  // Common mechanic mappings (user language -> database mechanics)
  const mechanicMappings: { [key: string]: string[] } = {
    'simultaneous': ['simultaneous-action-selection', 'real-time'],
    'worker placement': ['worker-placement', 'worker-placement-different-worker-types'],
    'deck building': ['deck-building', 'deckbuilding'],
    'area control': ['area-majority-influence', 'area-control'],
    'tile laying': ['tile-laying', 'tile-placement'],
    'pattern building': ['pattern-building', 'pattern-recognition'],
    'set collection': ['set-collection'],
    'engine building': ['engine-building'],
    'tableau building': ['tableau-building'],
    'drafting': ['card-drafting', 'drafting'],
    'auction': ['auction-bidding', 'auction'],
    'negotiation': ['negotiation', 'trading'],
    'coop': ['cooperative-game', 'cooperative'],
    'cooperative': ['cooperative-game', 'cooperative'],
    'trick taking': ['trick-taking'],
    'roll and write': ['roll-and-write', 'roll-write'],
    'dice rolling': ['dice-rolling'],
    'resource management': ['resource-management'],
    'hand management': ['hand-management']
  };
  
  // Find requested mechanics
  Object.entries(mechanicMappings).forEach(([userTerm, dbMechanics]) => {
    if (prompt.includes(userTerm)) {
      // Check which of these mechanics actually exist in our database
      const existingMechanics = dbMechanics.filter(mech => availableMechanics.includes(mech));
      requestedMechanics.push(...existingMechanics);
    }
  });
  
  // Also check for direct mechanic matches
  availableMechanics.forEach(mechanic => {
    const mechanicWords = mechanic.toLowerCase().replace(/-/g, ' ');
    if (prompt.includes(mechanicWords) && !requestedMechanics.includes(mechanic)) {
      requestedMechanics.push(mechanic);
    }
  });
  
  console.log('🎯 Requested mechanics found:', requestedMechanics);
  
  let games: Game[] = [];
  let matchType: 'exact' | 'partial' | 'broad' = 'broad';
  
  if (requestedMechanics.length > 0) {
    // Try exact match first (games with ALL requested mechanics)
    const exactMatches = await getGamesByMechanics(requestedMechanics, limit);
    
    if (exactMatches.length >= 3) {
      games = exactMatches;
      matchType = 'exact';
      console.log('✅ Using exact mechanic matches');
    } else {
      // Fall back to partial matches (games with ANY requested mechanics)
      const partialMatches = await getGamesByAnyMechanic(requestedMechanics, limit);
      if (partialMatches.length > 0) {
        games = partialMatches;
        matchType = 'partial';
        console.log('⚡ Using partial mechanic matches');
      }
    }
  }
  
  // If no mechanic matches or not enough games, do broader search
  if (games.length < 10) {
    console.log('🌐 Falling back to broader search');
    
    if (!supabase) {
      console.warn('⚠️ Supabase not available for broader search');
      return { games, availableMechanics, requestedMechanics, matchType: 'broad' };
    }
    
    // Extract other criteria from prompt
    const complexityHints = extractComplexityFromPrompt(prompt);
    const playerCountHints = extractPlayerCountFromPrompt(prompt);
    const themeHints = extractThemeFromPrompt(prompt);
    const categoryHints = extractCategoryFromPrompt(prompt);
    
    let query = supabase.from('games').select('*');
    let hasFilters = false;
    
    // Apply filters based on extracted criteria
    if (complexityHints.min !== null || complexityHints.max !== null) {
      if (complexityHints.min !== null) query = query.gte('complexity', complexityHints.min);
      if (complexityHints.max !== null) query = query.lte('complexity', complexityHints.max);
      hasFilters = true;
    }
    
    // Theme matching
    if (themeHints.length > 0) {
      const themeConditions = themeHints.map(theme => `theme.ilike.%${theme}%`).join(',');
      query = query.or(themeConditions);
      hasFilters = true;
    }
    
    // Category/tag matching
    if (categoryHints.length > 0) {
      const tagConditions = categoryHints.map(tag => `tags.cs.{${tag}}`).join(',');
      query = query.or(tagConditions);
      hasFilters = true;
    }
    
    // Player count filtering (if we can extract specific numbers)
    if (playerCountHints.min !== null && playerCountHints.max !== null && 
        playerCountHints.min === playerCountHints.max) {
      // For specific player counts, filter by games that support that count
      query = query.ilike('players', `%${playerCountHints.min}%`);
      hasFilters = true;
    }
    
    const { data, error } = await query.order('title').limit(limit);
    
    if (!error && data) {
      const newGames = data.filter(game => 
        !games.some(existingGame => existingGame.id === game.id)
      );
      games = [...games, ...newGames];
      console.log(`🌐 Broad search added ${newGames.length} games (had filters: ${hasFilters})`);
    }
    
    // If still no games or very few, get a diverse selection of popular/good games
    if (games.length < 5) {
      console.log('🎲 Falling back to diverse selection');
      
      if (supabase) {
        const { data: diverseGames, error: diverseError } = await supabase
          .from('games')
          .select('*')
        .order('complexity')
        .limit(limit * 2); // Get more to ensure diversity
      
        if (!diverseError && diverseGames) {
          // Create a diverse selection across different complexities and themes
          const diverseSelection = createDiverseSelection(diverseGames, limit);
          const newGames = diverseSelection.filter(game => 
            !games.some(existingGame => existingGame.id === game.id)
          );
          games = [...games, ...newGames];
          console.log(`🎲 Added ${newGames.length} diverse games`);
        }
      }
    }
    
    matchType = 'broad';
  }
  
  console.log(`🎯 Final search result: ${games.length} games, match type: ${matchType}`);
  
  return {
    games: games.slice(0, limit),
    availableMechanics,
    requestedMechanics,
    matchType
  };
}

/**
 * Extract complexity preferences from user prompt
 */
function extractComplexityFromPrompt(prompt: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;
  
  if (prompt.includes('simple') || prompt.includes('easy') || prompt.includes('family') || prompt.includes('casual')) {
    max = 2.5;
  }
  
  if (prompt.includes('complex') || prompt.includes('heavy') || prompt.includes('strategic') || prompt.includes('brain burn')) {
    min = 3.5;
  }
  
  if (prompt.includes('medium') || prompt.includes('moderate')) {
    min = 2.0;
    max = 3.5;
  }
  
  return { min, max };
}

/**
 * Extract player count preferences from user prompt
 */
function extractPlayerCountFromPrompt(prompt: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;
  
  // Look for specific numbers
  const numbers = prompt.match(/\b(\d+)\s*(?:player|person|people)\b/g);
  if (numbers) {
    const playerCounts = numbers.map(match => parseInt(match.match(/\d+/)?.[0] || '0'));
    if (playerCounts.length > 0) {
      min = Math.min(...playerCounts);
      max = Math.max(...playerCounts);
    }
  }
  
  // Look for keywords
  if (prompt.includes('solo') || prompt.includes('single player')) {
    min = 1;
    max = 1;
  }
  
  if (prompt.includes('two player') || prompt.includes('2 player') || prompt.includes('couples')) {
    min = 2;
    max = 2;
  }
  
  if (prompt.includes('party') || prompt.includes('large group')) {
    min = 6;
  }
  
  return { min, max };
}

/**
 * Extract category/gameplay style preferences from user prompt
 */
function extractCategoryFromPrompt(prompt: string): string[] {
  const categories: string[] = [];
  
  const categoryKeywords = {
    'family': ['family', 'kids', 'children', 'parents', 'casual'],
    'party': ['party', 'social', 'group', 'crowd', 'laughs'],
    'strategy': ['strategy', 'strategic', 'thinking', 'brain', 'deep'],
    'puzzly': ['puzzle', 'puzzly', 'logic', 'brain teaser'],
    'competitive': ['competitive', 'contest', 'tournament', 'serious'],
    'cooperative': ['cooperative', 'coop', 'team', 'together'],
    'quick': ['quick', 'fast', 'short', 'filler'],
    'relaxing': ['relaxing', 'chill', 'peaceful', 'zen', 'calm'],
    'date': ['date', 'romantic', 'couple', 'two player', '2 player'],
    'gateway': ['gateway', 'beginner', 'new', 'introduction', 'starter']
  };
  
  Object.entries(categoryKeywords).forEach(([category, keywords]) => {
    if (keywords.some(keyword => prompt.includes(keyword))) {
      categories.push(category);
    }
  });
  
  return categories;
}

/**
 * Create a diverse selection of games across different themes and complexities
 */
function createDiverseSelection(games: any[], targetCount: number): any[] {
  if (games.length <= targetCount) {
    return games;
  }
  
  // Group games by complexity ranges
  const complexityGroups = {
    light: games.filter(g => g.complexity && g.complexity <= 2.5),
    medium: games.filter(g => g.complexity && g.complexity > 2.5 && g.complexity < 3.5),
    heavy: games.filter(g => g.complexity && g.complexity >= 3.5),
    unknown: games.filter(g => !g.complexity)
  };
  
  // Also group by themes for diversity
  const themeGroups: { [key: string]: any[] } = {};
  games.forEach(game => {
    const theme = game.theme || 'unknown';
    if (!themeGroups[theme]) themeGroups[theme] = [];
    themeGroups[theme].push(game);
  });
  
  const selected: any[] = [];
  const complexityOrder = ['light', 'medium', 'heavy', 'unknown'];
  const themes = Object.keys(themeGroups);
  
  // Try to get a mix across complexities and themes
  let themeIndex = 0;
  let complexityIndex = 0;
  
  while (selected.length < targetCount && selected.length < games.length) {
    // Try current complexity group
    const currentComplexity = complexityOrder[complexityIndex % complexityOrder.length];
    const complexityPool = complexityGroups[currentComplexity as keyof typeof complexityGroups];
    
    if (complexityPool.length > 0) {
      // Try to find a game with a different theme
      let found = false;
      for (let i = 0; i < themes.length && !found; i++) {
        const theme = themes[(themeIndex + i) % themes.length];
        const candidate = complexityPool.find(game => 
          game.theme === theme && !selected.some(s => s.id === game.id)
        );
        
        if (candidate) {
          selected.push(candidate);
          found = true;
        }
      }
      
      // If no themed match, just take the first available from this complexity
      if (!found) {
        const candidate = complexityPool.find(game => 
          !selected.some(s => s.id === game.id)
        );
        if (candidate) {
          selected.push(candidate);
        }
      }
    }
    
    complexityIndex++;
    themeIndex++;
    
    // Safety break to avoid infinite loops
    if (complexityIndex > complexityOrder.length * 3) {
      break;
    }
  }
  
  // Fill remaining slots with any unselected games
  const remaining = games.filter(game => !selected.some(s => s.id === game.id));
  while (selected.length < targetCount && remaining.length > 0) {
    selected.push(remaining.shift());
  }
  
  return selected.slice(0, targetCount);
}
function extractThemeFromPrompt(prompt: string): string[] {
  const themes: string[] = [];
  
  const themeKeywords = {
    'nature': ['nature', 'wildlife', 'forest', 'ocean', 'environment'],
    'fantasy': ['fantasy', 'magic', 'dragons', 'medieval', 'adventure'],
    'sci-fi': ['space', 'sci-fi', 'science fiction', 'alien', 'robot', 'futuristic'],
    'historical': ['historical', 'history', 'ancient', 'war', 'civilization'],
    'economic': ['economic', 'business', 'trade', 'money', 'investment'],
    'abstract': ['abstract', 'puzzle', 'mathematical'],
    'horror': ['horror', 'zombie', 'scary', 'dark'],
    'nautical': ['pirate', 'sailing', 'naval', 'ocean'],
    'farming': ['farming', 'agriculture', 'harvest', 'crop']
  };
  
  Object.entries(themeKeywords).forEach(([theme, keywords]) => {
    if (keywords.some(keyword => prompt.includes(keyword))) {
      themes.push(theme);
    }
  });
  
  return themes;
}

/**
 * Validate that claimed mechanics actually exist for a game
 */
export function validateGameMechanics(game: Game, claimedMechanics: string[]): {
  valid: string[];
  invalid: string[];
  score: number;
} {
  const actualMechanics = game.mechanics || [];
  const valid: string[] = [];
  const invalid: string[] = [];
  
  claimedMechanics.forEach(mechanic => {
    if (actualMechanics.includes(mechanic)) {
      valid.push(mechanic);
    } else {
      invalid.push(mechanic);
    }
  });
  
  const score = valid.length / claimedMechanics.length;
  
  return { valid, invalid, score };
}
