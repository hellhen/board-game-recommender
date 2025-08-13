import { supabase } from './supabase';
import type { Game } from './supabase';

/**
 * Enhanced database functions optimized for large game collections (2000+ games)
 */

/**
 * Get a strategic sample of games for LLM processing instead of all games
 * This reduces token usage and improves performance for large databases
 */
export async function getStrategicGameSample(userPrompt: string, targetSize: number = 300): Promise<{
  games: Game[];
  samplingStrategy: string;
  totalAvailable: number;
}> {
  console.log(`🎯 Getting strategic sample of ${targetSize} games for prompt: "${userPrompt}"`);
  
  // First get total count
  const { count: totalCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 Total games available: ${totalCount}`);
  
  if (!totalCount || totalCount <= targetSize) {
    // If database is small enough, return all games
    const { data: allGames } = await supabase
      .from('games')
      .select('*')
      .order('title');
    
    return {
      games: allGames || [],
      samplingStrategy: 'all_games',
      totalAvailable: totalCount || 0
    };
  }
  
  // For large databases, use intelligent sampling
  const games = await performIntelligentSampling(userPrompt, targetSize);
  
  return {
    games,
    samplingStrategy: 'intelligent_sampling',
    totalAvailable: totalCount
  };
}

/**
 * Intelligent sampling strategy that selects diverse, relevant games
 */
async function performIntelligentSampling(userPrompt: string, targetSize: number): Promise<Game[]> {
  const samples: Game[] = [];
  const prompt = userPrompt.toLowerCase();
  
  // 1. Get targeted games based on prompt analysis (40% of sample)
  const targetedCount = Math.floor(targetSize * 0.4);
  const targetedGames = await getTargetedGames(prompt, targetedCount);
  samples.push(...targetedGames);
  console.log(`🎯 Added ${targetedGames.length} targeted games`);
  
  // 2. Get highly-rated games from different complexity ranges (30% of sample)
  const topGamesCount = Math.floor(targetSize * 0.3);
  const topGames = await getTopGamesByComplexity(topGamesCount, samples);
  samples.push(...topGames);
  console.log(`⭐ Added ${topGames.length} top-rated games across complexity ranges`);
  
  // 3. Get diverse theme representation (20% of sample)
  const diverseCount = Math.floor(targetSize * 0.2);
  const diverseGames = await getDiverseThemeGames(diverseCount, samples);
  samples.push(...diverseGames);
  console.log(`🌈 Added ${diverseGames.length} diverse theme games`);
  
  // 4. Fill remaining slots with random games to ensure variety (10% of sample)
  const remainingCount = targetSize - samples.length;
  if (remainingCount > 0) {
    const randomGames = await getRandomGames(remainingCount, samples);
    samples.push(...randomGames);
    console.log(`🎲 Added ${randomGames.length} random games for variety`);
  }
  
  return samples.slice(0, targetSize);
}

/**
 * Get games that are likely relevant based on prompt analysis
 */
async function getTargetedGames(prompt: string, count: number): Promise<Game[]> {
  let query = supabase.from('games').select('*');
  let conditions: string[] = [];
  
  // Extract criteria from prompt
  const complexityHints = extractComplexityFromPrompt(prompt);
  const themeHints = extractThemeFromPrompt(prompt);
  const mechanicHints = extractMechanicHints(prompt);
  const categoryHints = extractCategoryFromPrompt(prompt);
  
  // Build search conditions
  if (complexityHints.min !== null) {
    query = query.gte('complexity', complexityHints.min);
  }
  if (complexityHints.max !== null) {
    query = query.lte('complexity', complexityHints.max);
  }
  
  // Theme matching
  if (themeHints.length > 0) {
    const themeConditions = themeHints.map(theme => `theme.ilike.%${theme}%`);
    conditions.push(`(${themeConditions.join(' or ')})`);
  }
  
  // Mechanic matching
  if (mechanicHints.length > 0) {
    const mechanicConditions = mechanicHints.map(mech => `mechanics.cs.{${mech}}`);
    conditions.push(`(${mechanicConditions.join(' or ')})`);
  }
  
  // Tag matching for categories
  if (categoryHints.length > 0) {
    const tagConditions = categoryHints.map(tag => `tags.cs.{${tag}}`);
    conditions.push(`(${tagConditions.join(' or ')})`);
  }
  
  // Player count hints
  const playerHints = extractPlayerCountFromPrompt(prompt);
  if (playerHints.min === playerHints.max && playerHints.min !== null) {
    query = query.ilike('players', `%${playerHints.min}%`);
  }
  
  // Apply conditions
  if (conditions.length > 0) {
    query = query.or(conditions.join(' or '));
  }
  
  const { data } = await query
    .order('title')
    .limit(count * 2); // Get extra to allow for filtering
  
  return (data || []).slice(0, count);
}

/**
 * Get top games from different complexity ranges to ensure quality
 */
async function getTopGamesByComplexity(count: number, exclude: Game[]): Promise<Game[]> {
  const excludeIds = new Set(exclude.map(g => g.id));
  const games: Game[] = [];
  
  const complexityRanges = [
    { min: 0, max: 2.5, name: 'Light' },
    { min: 2.5, max: 3.5, name: 'Medium' },
    { min: 3.5, max: 5, name: 'Heavy' }
  ];
  
  const perRange = Math.ceil(count / complexityRanges.length);
  
  for (const range of complexityRanges) {
    const { data } = await supabase
      .from('games')
      .select('*')
      .gte('complexity', range.min)
      .lt('complexity', range.max)
      .not('id', 'in', `(${Array.from(excludeIds).join(',')})`)
      .order('title') // Could order by rating if available
      .limit(perRange);
    
    if (data) {
      games.push(...data);
      data.forEach(game => excludeIds.add(game.id));
    }
  }
  
  return games.slice(0, count);
}

/**
 * Get games from diverse themes to ensure variety
 */
async function getDiverseThemeGames(count: number, exclude: Game[]): Promise<Game[]> {
  const excludeIds = new Set(exclude.map(g => g.id));
  
  // Get available themes
  const { data: themeData } = await supabase
    .from('games')
    .select('theme')
    .not('theme', 'is', null)
    .not('id', 'in', `(${Array.from(excludeIds).join(',')})`)
    .limit(200); // Get a sample to extract themes from
  
  const themes = [...new Set(themeData?.map((t: any) => t.theme).filter(Boolean) || [])];
  const perTheme = Math.ceil(count / Math.min(themes.length, 8)); // Max 8 themes
  
  const games: Game[] = [];
  
  for (const theme of themes.slice(0, 8)) {
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('theme', theme)
      .not('id', 'in', `(${Array.from(excludeIds).join(',')})`)
      .limit(perTheme);
    
    if (data && games.length < count) {
      const toAdd = data.slice(0, count - games.length);
      games.push(...toAdd);
      toAdd.forEach(game => excludeIds.add(game.id));
    }
  }
  
  return games;
}

/**
 * Get random games for variety
 */
async function getRandomGames(count: number, exclude: Game[]): Promise<Game[]> {
  const excludeIds = new Set(exclude.map(g => g.id));
  
  const { data } = await supabase
    .from('games')
    .select('*')
    .not('id', 'in', `(${Array.from(excludeIds).join(',')})`)
    .order('title') // Random would be better but not available in Supabase
    .limit(count * 3); // Get extra for randomization
  
  if (!data || data.length === 0) return [];
  
  // Shuffle and take requested count
  const shuffled = data.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Enhanced game matching with better fuzzy logic and scoring
 */
export async function findEnhancedGameMatches(
  aiRecommendations: any[], 
  allGames: Game[]
): Promise<Array<{
  aiRecommendation: any;
  dbGame: Game | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'none';
}>> {
  console.log(`🔍 Enhanced matching of ${aiRecommendations.length} AI recommendations against ${allGames.length} games`);
  
  const results = [];
  
  for (const aiRec of aiRecommendations) {
    const match = await findBestEnhancedMatch(aiRec.title, allGames);
    results.push({
      aiRecommendation: aiRec,
      dbGame: match.game,
      confidence: match.confidence,
      matchType: match.matchType
    });
  }
  
  // Sort by confidence (best matches first)
  results.sort((a, b) => b.confidence - a.confidence);
  
  console.log(`✅ Matching complete: ${results.filter(r => r.dbGame).length} matches found`);
  return results;
}

/**
 * Enhanced game matching with multiple strategies and confidence scoring
 */
async function findBestEnhancedMatch(aiTitle: string, allGames: Game[]): Promise<{
  game: Game | null;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'none';
}> {
  const normalizeTitle = (title: string) => 
    title.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();

  const normalizedAiTitle = normalizeTitle(aiTitle);
  
  // Strategy 1: Exact match
  let match = allGames.find(game => 
    normalizeTitle(game.title) === normalizedAiTitle
  );
  
  if (match) {
    return { game: match, confidence: 1.0, matchType: 'exact' };
  }
  
  // Strategy 2: High-confidence fuzzy matching
  const aiWords = normalizedAiTitle.split(' ').filter(word => word.length > 2);
  
  if (aiWords.length > 0) {
    let bestMatch: Game | null = null;
    let bestScore = 0;
    
    for (const game of allGames) {
      const gameWords = normalizeTitle(game.title).split(' ').filter(word => word.length > 2);
      const score = calculateMatchScore(aiWords, gameWords, normalizedAiTitle, normalizeTitle(game.title));
      
      if (score > bestScore && score >= 0.7) { // Require high confidence
        bestScore = score;
        bestMatch = game;
      }
    }
    
    if (bestMatch) {
      return { game: bestMatch, confidence: bestScore, matchType: 'fuzzy' };
    }
  }
  
  return { game: null, confidence: 0, matchType: 'none' };
}

/**
 * Calculate match score between two game titles
 */
function calculateMatchScore(aiWords: string[], gameWords: string[], aiTitle: string, gameTitle: string): number {
  // Word overlap score
  const commonWords = aiWords.filter(word => gameWords.includes(word));
  const wordOverlap = commonWords.length / Math.max(aiWords.length, gameWords.length);
  
  // Length similarity bonus
  const lengthSimilarity = 1 - Math.abs(aiTitle.length - gameTitle.length) / Math.max(aiTitle.length, gameTitle.length);
  
  // Substring matching bonus
  const substringMatch = aiTitle.includes(gameTitle.substring(0, Math.min(5, gameTitle.length))) ||
                        gameTitle.includes(aiTitle.substring(0, Math.min(5, aiTitle.length))) ? 0.2 : 0;
  
  // Combined score with weights
  const score = (wordOverlap * 0.7) + (lengthSimilarity * 0.2) + substringMatch;
  
  return Math.min(1.0, score);
}

/**
 * Get games optimized for specific use cases
 */
export async function getOptimizedGameSelection(
  criteria: {
    playerCount?: number;
    complexity?: { min: number; max: number };
    playtime?: { max: number };
    mechanics?: string[];
    themes?: string[];
    tags?: string[];
  },
  limit: number = 50
): Promise<Game[]> {
  let query = supabase.from('games').select('*');
  
  // Apply filters
  if (criteria.playerCount) {
    query = query.ilike('players', `%${criteria.playerCount}%`);
  }
  
  if (criteria.complexity) {
    if (criteria.complexity.min) query = query.gte('complexity', criteria.complexity.min);
    if (criteria.complexity.max) query = query.lte('complexity', criteria.complexity.max);
  }
  
  if (criteria.mechanics && criteria.mechanics.length > 0) {
    query = query.overlaps('mechanics', criteria.mechanics);
  }
  
  if (criteria.themes && criteria.themes.length > 0) {
    const themeConditions = criteria.themes.map(theme => `theme.ilike.%${theme}%`);
    query = query.or(themeConditions.join(','));
  }
  
  if (criteria.tags && criteria.tags.length > 0) {
    query = query.overlaps('tags', criteria.tags);
  }
  
  const { data, error } = await query
    .order('title')
    .limit(limit);
  
  if (error) {
    console.error('Error in optimized game selection:', error);
    return [];
  }
  
  return data || [];
}

// Helper functions (extracted from enhanced-database.ts for consistency)
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

function extractPlayerCountFromPrompt(prompt: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;
  
  // Look for specific numbers
  const numbers = prompt.match(/\\b(\\d+)\\s*(?:player|person|people)\\b/g);
  if (numbers) {
    const playerCounts = numbers.map(match => parseInt(match.match(/\\d+/)?.[0] || '0'));
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

function extractMechanicHints(prompt: string): string[] {
  const mechanics: string[] = [];
  
  const mechanicKeywords = {
    'worker-placement': ['worker placement', 'workers', 'placement'],
    'deck-building': ['deck building', 'deckbuilding', 'deck construction'],
    'area-control': ['area control', 'territory', 'area majority'],
    'engine-building': ['engine building', 'engine'],
    'cooperative': ['cooperative', 'coop', 'together'],
    'drafting': ['drafting', 'draft'],
    'auction': ['auction', 'bidding'],
    'dice-rolling': ['dice', 'rolling dice'],
    'tile-placement': ['tile placement', 'tile laying'],
    'set-collection': ['set collection', 'collecting sets']
  };
  
  Object.entries(mechanicKeywords).forEach(([mechanic, keywords]) => {
    if (keywords.some(keyword => prompt.includes(keyword))) {
      mechanics.push(mechanic);
    }
  });
  
  return mechanics;
}

function extractCategoryFromPrompt(prompt: string): string[] {
  const categories: string[] = [];
  
  const categoryKeywords = {
    'family': ['family', 'kids', 'children', 'parents', 'casual'],
    'party': ['party', 'social', 'group', 'crowd', 'laughs'],
    'strategy': ['strategy', 'strategic', 'thinking', 'brain', 'deep'],
    'competitive': ['competitive', 'contest', 'tournament', 'serious'],
    'quick': ['quick', 'fast', 'short', 'filler'],
    'date': ['date', 'romantic', 'couple', 'two player', '2 player']
  };
  
  Object.entries(categoryKeywords).forEach(([category, keywords]) => {
    if (keywords.some(keyword => prompt.includes(keyword))) {
      categories.push(category);
    }
  });
  
  return categories;
}
