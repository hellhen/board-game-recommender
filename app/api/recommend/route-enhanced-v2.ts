import { NextRequest } from 'next/server';
import { OpenAI } from 'openai';
import { supabase } from '@/lib/supabase';
import type { Game } from '@/lib/supabase';
import { 
  getStrategicGameSample,
  findEnhancedGameMatches,
  getOptimizedGameSelection
} from '@/lib/large-database-optimization';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Enhanced recommendation system optimized for large databases (2000+ games)
 * 
 * Features:
 * - Intelligent game sampling instead of sending all games to LLM
 * - Multiple recommendation strategies based on database size
 * - Enhanced matching algorithms with confidence scoring
 * - Better prompt engineering for more accurate results
 * - Performance optimizations for large datasets
 */

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`🎲 Enhanced recommendation request: "${message}"`);

    // Get total game count to determine strategy
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });

    console.log(`📊 Total games in database: ${totalGames}`);

    if (!totalGames) {
      return new Response(
        JSON.stringify({ 
          error: 'No games found in database',
          recommendations: []
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let recommendations: Game[] = [];

    // Choose strategy based on database size
    if (totalGames <= 500) {
      // Small database: Use all games directly
      console.log('📝 Using SMALL database strategy (all games to LLM)');
      recommendations = await getRecommendationsSmallDatabase(message);
    } else {
      // Large database: Use intelligent sampling + matching strategy
      console.log('🧠 Using LARGE database strategy (strategic sampling + matching)');
      recommendations = await getRecommendationsLargeDatabase(message);
    }

    const responseTime = Date.now();
    console.log(`✅ Recommendations generated successfully: ${recommendations.length} games`);

    return new Response(
      JSON.stringify({
        recommendations,
        metadata: {
          totalGamesInDatabase: totalGames,
          strategy: totalGames <= 500 ? 'small_database' : 'large_database',
          timestamp: new Date().toISOString(),
          count: recommendations.length
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error in enhanced recommendations:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to generate recommendations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * Small database strategy: Send all games to LLM for direct selection
 */
async function getRecommendationsSmallDatabase(userPrompt: string): Promise<Game[]> {
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .order('title');

  if (!allGames?.length) {
    throw new Error('No games found');
  }

  const gameList = formatGamesForLLM(allGames);
  
  const prompt = `You are a board game expert. Based on this request: "${userPrompt}"

Please recommend exactly 8 games from this list. Return your response as a JSON array with this exact format:
[
  {
    "title": "Game Title",
    "reason": "Why this game fits the request"
  }
]

Available games:
${gameList}

Important: Only recommend games from the provided list. Return valid JSON only.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 2000,
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from AI');
  }

  const aiRecommendations = parseAIResponse(response);
  return matchRecommendationsToGames(aiRecommendations, allGames);
}

/**
 * Large database strategy: Strategic sampling + enhanced matching
 */
async function getRecommendationsLargeDatabase(userPrompt: string): Promise<Game[]> {
  // Step 1: Get strategic sample of games
  const { games: sampleGames, samplingStrategy } = await getStrategicGameSample(userPrompt, 300);
  
  console.log(`🎯 Strategic sampling complete: ${sampleGames.length} games selected using ${samplingStrategy}`);
  
  if (sampleGames.length === 0) {
    throw new Error('No games found in sample');
  }

  // Step 2: Generate recommendations from sample
  const gameList = formatGamesForLLM(sampleGames);
  
  const prompt = `You are a board game expert. Based on this request: "${userPrompt}"

Please recommend exactly 12 games. You can recommend games from the provided list, or suggest other games you know that would be perfect for this request.

Return your response as a JSON array with this exact format:
[
  {
    "title": "Game Title",
    "reason": "Why this game fits the request"
  }
]

Here's a curated selection of games to consider (but you can suggest others too):
${gameList}

Important: Return valid JSON only.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.8,
    max_tokens: 3000,
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error('No response from AI');
  }

  const aiRecommendations = parseAIResponse(response);
  
  // Step 3: Get all games for matching
  const { data: allGames } = await supabase
    .from('games')
    .select('*')
    .order('title');

  if (!allGames?.length) {
    throw new Error('No games found in database');
  }

  // Step 4: Enhanced matching with confidence scoring
  const matchResults = await findEnhancedGameMatches(aiRecommendations, allGames);
  
  // Step 5: Return matched games, prioritizing high-confidence matches
  const successfulMatches = matchResults
    .filter(result => result.dbGame !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .map(result => result.dbGame!)
    .slice(0, 8); // Return top 8 matches

  console.log(`🎯 Enhanced matching results: ${successfulMatches.length} high-confidence matches found`);
  
  // If we don't have enough matches, fill with targeted games from database
  if (successfulMatches.length < 8) {
    const additionalGames = await getOptimizedGameSelection(
      extractCriteriaFromPrompt(userPrompt),
      8 - successfulMatches.length
    );
    
    // Add games not already in results
    const existingIds = new Set(successfulMatches.map(g => g.id));
    const newGames = additionalGames.filter(g => !existingIds.has(g.id));
    successfulMatches.push(...newGames.slice(0, 8 - successfulMatches.length));
  }

  return successfulMatches;
}

/**
 * Format games for LLM consumption
 */
function formatGamesForLLM(games: Game[]): string {
  return games
    .map(game => {
      const parts = [game.title];
      if (game.players) parts.push(`${game.players} players`);
      if (game.complexity) parts.push(`Complexity: ${game.complexity}/5`);
      if (game.theme) parts.push(`Theme: ${game.theme}`);
      if (game.mechanics?.length) parts.push(`Mechanics: ${game.mechanics.join(', ')}`);
      return parts.join(' | ');
    })
    .join('\\n');
}

/**
 * Parse AI response with better error handling
 */
function parseAIResponse(response: string): Array<{ title: string; reason: string }> {
  try {
    // Clean the response
    let cleanedResponse = response.trim();
    
    // Remove markdown code blocks if present
    if (cleanedResponse.startsWith('```json')) {
      cleanedResponse = cleanedResponse.replace(/```json\\n?/, '').replace(/\\n?```$/, '');
    } else if (cleanedResponse.startsWith('```')) {
      cleanedResponse = cleanedResponse.replace(/```\\n?/, '').replace(/\\n?```$/, '');
    }
    
    const parsed = JSON.parse(cleanedResponse);
    
    if (Array.isArray(parsed)) {
      return parsed.filter(item => item.title && typeof item.title === 'string');
    }
    
    return [];
  } catch (error) {
    console.error('❌ Failed to parse AI response:', error);
    console.log('Raw response:', response);
    
    // Fallback: try to extract game titles from text
    const lines = response.split('\\n');
    const recommendations = [];
    
    for (const line of lines) {
      if (line.includes('"title"')) {
        const titleMatch = line.match(/"title"\\s*:\\s*"([^"]+)"/);
        if (titleMatch) {
          recommendations.push({
            title: titleMatch[1],
            reason: 'Extracted from response'
          });
        }
      }
    }
    
    return recommendations;
  }
}

/**
 * Match AI recommendations to actual database games
 */
function matchRecommendationsToGames(aiRecommendations: Array<{ title: string; reason: string }>, allGames: Game[]): Game[] {
  const matches: Game[] = [];
  
  for (const aiRec of aiRecommendations) {
    const game = findGameMatch(aiRec.title, allGames);
    if (game && !matches.find(g => g.id === game.id)) {
      matches.push(game);
    }
  }
  
  return matches;
}

/**
 * Simple game matching for small database strategy
 */
function findGameMatch(aiTitle: string, allGames: Game[]): Game | null {
  const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedAiTitle = normalize(aiTitle);
  
  // Exact match
  let match = allGames.find(game => normalize(game.title) === normalizedAiTitle);
  if (match) return match;
  
  // Partial match
  match = allGames.find(game => {
    const normalizedGameTitle = normalize(game.title);
    return normalizedGameTitle.includes(normalizedAiTitle) || 
           normalizedAiTitle.includes(normalizedGameTitle);
  });
  
  return match || null;
}

/**
 * Extract search criteria from user prompt for targeted database queries
 */
function extractCriteriaFromPrompt(prompt: string): {
  playerCount?: number;
  complexity?: { min: number; max: number };
  mechanics?: string[];
  themes?: string[];
  tags?: string[];
} {
  const criteria: any = {};
  
  // Extract player count
  const playerMatch = prompt.match(/(\\d+)\\s*(?:player|person|people)/i);
  if (playerMatch) {
    criteria.playerCount = parseInt(playerMatch[1]);
  }
  
  // Extract complexity
  if (prompt.includes('simple') || prompt.includes('easy') || prompt.includes('family')) {
    criteria.complexity = { min: 0, max: 2.5 };
  } else if (prompt.includes('complex') || prompt.includes('heavy')) {
    criteria.complexity = { min: 3.5, max: 5 };
  }
  
  // Extract themes
  const themeKeywords = ['fantasy', 'sci-fi', 'historical', 'nature', 'economic'];
  criteria.themes = themeKeywords.filter(theme => 
    prompt.toLowerCase().includes(theme)
  );
  
  // Extract mechanics
  const mechanicKeywords = ['worker placement', 'deck building', 'cooperative', 'area control'];
  criteria.mechanics = mechanicKeywords.filter(mechanic => 
    prompt.toLowerCase().includes(mechanic.toLowerCase())
  );
  
  return criteria;
}
