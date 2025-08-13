import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { ResponseSchema, SommelierResponse } from '../../../lib/schema';
import { getAllGames } from '../../../lib/database';
import { intelligentGameSearch, validateGameMechanics, getAllMechanics } from '../../../lib/enhanced-database';
import { supabase } from '../../../lib/supabase';
import { ENHANCED_SYSTEM_PROMPT } from '../../../lib/enhanced-prompt';

// Simple rate limiting - store last request times by IP
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10000; // 10 seconds between requests per IP

/**
 * Simple, effective recommendation system that lets LLM pick freely but validates results
 */
async function getEnhancedRecommendations(userPrompt: string): Promise<SommelierResponse> {
  console.log('🚀 Enhanced recommendation system starting...');
  
  // Get all games from database for LLM to choose from
  const allGames = await getAllGames();
  console.log(`📋 Database has ${allGames.length} games for LLM to choose from`);
  
  if (allGames.length === 0) {
    return {
      followUps: ["Database appears to be empty. Please populate the games table first."],
      recommendations: [],
      metadata: {
        interpretedNeeds: ["no-database"],
        notes: "No games found in database"
      }
    };
  }

  // Check if OpenAI is available
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const model = process.env.MODEL || 'gpt-4o-mini';
  
  if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
    console.log('No OpenAI API key, using fallback');
    return getSmartFallbackRecommendations(userPrompt, allGames);
  }
  
  // Decide approach based on database size
  if (allGames.length <= 500) {
    // Small database - send everything to LLM
    console.log(`📤 Sending ALL ${allGames.length} games to LLM (small database)`);
    return await getLLMRecommendationsFromFullDatabase(userPrompt, allGames, openaiApiKey, model);
  } else {
    // Large database - use the "recommend best games then match" approach
    console.log(`📤 Large database (${allGames.length} games) - using recommendation + matching approach`);
    return await getLLMRecommendationsThenMatch(userPrompt, allGames, openaiApiKey, model);
  }
}

/**
 * Send full database to LLM when database is small enough
 */
async function getLLMRecommendationsFromFullDatabase(
  userPrompt: string, 
  allGames: any[], 
  openaiApiKey: string, 
  model: string
): Promise<SommelierResponse> {
  const gameContext = allGames.map(game => ({
    title: game.title,
    mechanics: game.mechanics || [],
    theme: game.theme,
    players: game.players,
    playtime: game.playtime,
    complexity: game.complexity,
    tags: game.tags || []
  }));
  
  const aiPrompt = `User request: "${userPrompt}"

AVAILABLE GAMES (choose ONLY from these - this is the complete database):
${JSON.stringify(gameContext, null, 2)}

Please recommend 4-5 games from the above list that best match the user's request. Use your expertise to pick the absolute best games that truly fit what they're looking for. You have access to the entire database, so pick the very best matches.

IMPORTANT: Only recommend games from the provided list above. Use only the mechanics explicitly listed for each game.`;

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    console.log('📡 Calling OpenAI with full database...');
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: ENHANCED_SYSTEM_PROMPT },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('📡 OpenAI response received');
    
    const aiResponse = JSON.parse(responseText);
    console.log('🔍 AI recommended:', aiResponse.recommendations?.map((r: any) => r.title) || []);
    
    // Validate and clean up AI recommendations
    return validateAndCleanRecommendations(aiResponse, allGames, userPrompt);
    
  } catch (error) {
    console.error('Error in full database LLM recommendation:', error);
    return getSmartFallbackRecommendations(userPrompt, allGames);
  }
}

/**
 * Let LLM recommend best games from general knowledge, then match to database
 */
async function getLLMRecommendationsThenMatch(
  userPrompt: string, 
  allGames: any[], 
  openaiApiKey: string, 
  model: string
): Promise<SommelierResponse> {
  const aiPrompt = `User request: "${userPrompt}"

Please recommend 8-10 board games that would be perfect for this request. Focus on recommending the absolute best games for this situation, regardless of availability. Use your general knowledge of board games to pick truly excellent matches.

You must respond with valid JSON following the schema specified in your system prompt. Don't worry about whether these games are in any specific database - just recommend the best games for this request.`;

  try {
    const openai = new OpenAI({ apiKey: openaiApiKey });
    
    console.log('📡 Calling OpenAI for general game recommendations...');
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: ENHANCED_SYSTEM_PROMPT },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('📡 OpenAI response received');
    
    const aiResponse = JSON.parse(responseText);
    console.log('🔍 AI recommended these games:', aiResponse.recommendations?.map((r: any) => r.title) || []);
    
    // Now match AI recommendations to our database
    return await matchRecommendationsToDatabase(aiResponse, allGames, userPrompt);
    
  } catch (error) {
    console.error('Error in LLM recommendation + matching:', error);
    return getSmartFallbackRecommendations(userPrompt, allGames);
  }
}

/**
 * Match LLM recommendations to games in our database
 */
async function matchRecommendationsToDatabase(
  aiResponse: any, 
  allGames: any[], 
  userPrompt: string
): Promise<SommelierResponse> {
  console.log('🔍 Matching AI recommendations to database...');
  
  const matchedGames = [];
  const unmatchedGames = [];
  
  for (const aiRec of aiResponse.recommendations || []) {
    // Try to find this game in our database with fuzzy matching
    const match = await findBestGameMatch(aiRec.title, allGames);
    
    if (match) {
      console.log(`✅ Matched "${aiRec.title}" → "${match.title}"`);
      matchedGames.push({
        aiRecommendation: aiRec,
        dbGame: match
      });
    } else {
      console.log(`❌ Could not match "${aiRec.title}"`);
      unmatchedGames.push(aiRec);
    }
  }
  
  // Convert matched games to recommendations
  const recommendations = matchedGames.map(({ aiRecommendation, dbGame }) => ({
    id: dbGame.id || '',
    title: dbGame.title,
    sommelierPitch: aiRecommendation.sommelierPitch || generateSimplePitch(dbGame, userPrompt),
    whyItFits: [
      aiRecommendation.reasoning || 'Excellent match for your request',
      `Actual mechanics: ${(dbGame.mechanics || []).slice(0, 3).join(', ') || 'Various'}`,
      `${dbGame.complexity ? `Complexity: ${dbGame.complexity}` : ''} | ${dbGame.players || 'Variable players'} | ${dbGame.playtime || 'Variable time'}`
    ],
    specs: {
      players: dbGame.players || null,
      playtime: dbGame.playtime || null,
      complexity: dbGame.complexity ?? null
    },
    mechanics: dbGame.mechanics || [],
    theme: dbGame.theme || 'Various',
    price: { amount: null, store: null, url: null },
    alternates: []
  }));
  
  // Create follow-ups for unmatched games
  const followUps = [];
  if (unmatchedGames.length > 0) {
    followUps.push(`I also wanted to recommend ${unmatchedGames.slice(0, 2).map(g => g.title).join(' and ')}, but they're not in our database.`);
    followUps.push('Want me to suggest similar games that we do have?');
  }
  
  const notes = `AI recommended ${(aiResponse.recommendations || []).length} games, matched ${recommendations.length} to database. ${unmatchedGames.length > 0 ? `Couldn't find: ${unmatchedGames.map(g => g.title).join(', ')}.` : ''}`;
  
  return {
    followUps,
    recommendations,
    metadata: {
      interpretedNeeds: [userPrompt.slice(0, 50)],
      notes
    }
  };
}

/**
 * Improved game matching with fuzzy logic
 */
async function findBestGameMatch(aiTitle: string, allGames: any[]): Promise<any | null> {
  const normalizeTitle = (title: string) => 
    title.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();

  const normalizedAiTitle = normalizeTitle(aiTitle);
  
  // Try exact match first
  let match = allGames.find(game => 
    normalizeTitle(game.title) === normalizedAiTitle
  );
  
  if (match) {
    return match;
  }
  
  // Try partial matches with good confidence
  const words = normalizedAiTitle.split(' ').filter(word => word.length > 2);
  if (words.length >= 2) {
    match = allGames.find(game => {
      const gameWords = normalizeTitle(game.title).split(' ').filter(word => word.length > 2);
      const commonWords = words.filter(word => gameWords.includes(word));
      const confidence = commonWords.length / words.length;
      return confidence >= 0.7; // At least 70% word match
    });
    
    if (match) {
      return match;
    }
  }
  
  // Try single word match for simple titles
  if (words.length === 1 && words[0].length > 3) {
    match = allGames.find(game => 
      normalizeTitle(game.title).includes(words[0]) ||
      words[0].includes(normalizeTitle(game.title).split(' ')[0])
    );
    
    if (match) {
      return match;
    }
  }
  
  return null;
}
function createDiverseGameSelection(allGames: any[], targetCount: number): any[] {
  if (allGames.length <= targetCount) {
    return allGames;
  }
  
  // Create a representative sample across different categories
  const selected: any[] = [];
  const used = new Set<string>();
  
  // Get some from each complexity range
  const complexityRanges = [
    { min: 0, max: 2.5, target: Math.floor(targetCount * 0.3) }, // Light games
    { min: 2.5, max: 3.5, target: Math.floor(targetCount * 0.4) }, // Medium games  
    { min: 3.5, max: 5, target: Math.floor(targetCount * 0.3) } // Heavy games
  ];
  
  for (const range of complexityRanges) {
    const gamesInRange = allGames.filter(game => 
      game.complexity >= range.min && game.complexity < range.max && !used.has(game.id)
    );
    
    // Shuffle and take up to target amount from this range
    const shuffled = gamesInRange.sort(() => 0.5 - Math.random());
    const toTake = Math.min(range.target, shuffled.length);
    
    for (let i = 0; i < toTake && selected.length < targetCount; i++) {
      selected.push(shuffled[i]);
      used.add(shuffled[i].id);
    }
  }
  
  // Fill remaining slots with random games
  const remaining = allGames.filter(game => !used.has(game.id));
  const shuffledRemaining = remaining.sort(() => 0.5 - Math.random());
  
  for (let i = 0; i < shuffledRemaining.length && selected.length < targetCount; i++) {
    selected.push(shuffledRemaining[i]);
  }
  
  return selected;
}

/**
 * Validate and clean up LLM recommendations
 */
function validateAndCleanRecommendations(aiResponse: any, allGames: any[], userPrompt: string): SommelierResponse {
  const validatedRecommendations = [];
  const validationIssues: string[] = [];
  
  for (const rec of aiResponse.recommendations || []) {
    // Find the actual game in our database
    const actualGame = allGames.find((game: any) => 
      game.title.toLowerCase() === rec.title.toLowerCase()
    );
    
    if (!actualGame) {
      console.warn(`⚠️ AI recommended "${rec.title}" which is not in database`);
      validationIssues.push(`"${rec.title}" not found in database`);
      continue;
    }
    
    // Validate claimed mechanics
    const actualMechanics = actualGame.mechanics || [];
    const claimedMechanics = rec.mechanics || [];
    const validMechanics = claimedMechanics.filter((mech: string) => actualMechanics.includes(mech));
    const invalidMechanics = claimedMechanics.filter((mech: string) => !actualMechanics.includes(mech));
    
    if (invalidMechanics.length > 0) {
      console.warn(`⚠️ AI claimed invalid mechanics for ${actualGame.title}:`, invalidMechanics);
      validationIssues.push(`${actualGame.title} doesn't have: ${invalidMechanics.join(', ')}`);
    }
    
    // Create clean recommendation using database data
    validatedRecommendations.push({
      id: actualGame.id || '',
      title: actualGame.title,
      sommelierPitch: rec.sommelierPitch || generateSimplePitch(actualGame, userPrompt),
      whyItFits: [
        rec.reasoning || `Great match for your request`,
        `Actual mechanics: ${actualMechanics.slice(0, 3).join(', ')}`,
        `${actualGame.complexity ? `Complexity: ${actualGame.complexity}` : ''} | ${actualGame.players || 'Variable players'} | ${actualGame.playtime || 'Variable time'}`
      ],
      specs: {
        players: actualGame.players || null,
        playtime: actualGame.playtime || null,
        complexity: actualGame.complexity ?? null
      },
      mechanics: actualMechanics, // Use actual mechanics, not LLM claims
      theme: actualGame.theme || 'Various',
      price: { amount: null, store: null, url: null },
      alternates: []
    });
  }
  
  // Create response with validation notes
  let notes = `AI selected ${aiResponse.recommendations?.length || 0} games, validated ${validatedRecommendations.length}.`;
  if (validationIssues.length > 0) {
    notes += ` Corrections: ${validationIssues.join('; ')}.`;
  }
  
  return {
    followUps: validatedRecommendations.length < 3 ? [
      "Want me to suggest a few more options?",
      "Looking for games with different criteria?"
    ] : [],
    recommendations: validatedRecommendations,
    metadata: {
      interpretedNeeds: [userPrompt.slice(0, 50)],
      notes
    }
  };
}

/**
 * Simple fallback when OpenAI is unavailable
 */
function getSmartFallbackRecommendations(userPrompt: string, allGames: any[]): SommelierResponse {
  console.log('🛡️ Using smart fallback recommendations');
  
  // Score games based on the prompt
  const scoredGames = allGames.map(game => ({
    ...game,
    score: calculateSimpleScore(game, userPrompt)
  }));
  
  // Sort by score and take top games
  scoredGames.sort((a, b) => b.score - a.score);
  const topGames = scoredGames.slice(0, 4);
  
  const recommendations = topGames.map(game => ({
    id: game.id || '',
    title: game.title,
    sommelierPitch: generateSimplePitch(game, userPrompt),
    whyItFits: [
      `Score: ${game.score.toFixed(1)} - Good match for your request`,
      `Mechanics: ${(game.mechanics || []).slice(0, 3).join(', ') || 'Various'}`,
      `${game.complexity ? `Complexity: ${game.complexity}` : ''} | ${game.players || 'Variable players'} | ${game.playtime || 'Variable time'}`
    ],
    specs: {
      players: game.players || null,
      playtime: game.playtime || null,
      complexity: game.complexity ?? null
    },
    mechanics: game.mechanics || [],
    theme: game.theme || 'Various',
    price: { amount: null, store: null, url: null },
    alternates: []
  }));
  
  return {
    followUps: [],
    recommendations,
    metadata: {
      interpretedNeeds: [userPrompt.slice(0, 50)],
      notes: `Fallback mode: selected top ${recommendations.length} games based on scoring algorithm.`
    }
  };
}

/**
 * Simple scoring for fallback recommendations
 */
function calculateSimpleScore(game: any, prompt: string): number {
  let score = 1; // Base score
  const p = prompt.toLowerCase();
  
  // Theme matching
  if (game.theme && p.includes(game.theme.toLowerCase())) score += 3;
  
  // Complexity preferences
  if (game.complexity) {
    if (/family|easy|light|simple|casual/.test(p) && game.complexity <= 2.5) score += 3;
    if (/heavy|complex|strategic|deep/.test(p) && game.complexity >= 3.5) score += 3;
    if (/medium|moderate/.test(p) && game.complexity >= 2.0 && game.complexity <= 3.5) score += 2;
  }
  
  // Tag matching
  if (game.tags) {
    game.tags.forEach((tag: string) => {
      if (p.includes(tag.replace('-', ' '))) score += 2;
    });
  }
  
  // Player count
  if (game.players) {
    if (/solo|single/.test(p) && game.players.includes('1')) score += 2;
    if (/two player|2 player|couple|date/.test(p) && game.players.includes('2')) score += 2;
    if (/party|group/.test(p) && game.players.match(/[6-9]/)) score += 2;
  }
  
  // Award winners get bonus
  if (game.tags?.includes('award-winner')) score += 2;
  
  return score;
}

/**
 * Generate simple, contextual pitches
 */
function generateSimplePitch(game: any, userPrompt: string): string {
  const gameName = game.title;
  const theme = game.theme;
  const complexity = game.complexity;
  const prompt = userPrompt.toLowerCase();
  
  // Context-aware pitches
  if (/family|kids/.test(prompt)) {
    return `${gameName}: family game night without the usual chaos and tears.`;
  }
  
  if (/date|couple|romantic/.test(prompt)) {
    return `${gameName}: perfect for when dinner conversation reaches its limits.`;
  }
  
  if (/party|social|group/.test(prompt)) {
    return `${gameName}: turns your social gathering into actual fun instead of small talk.`;
  }
  
  if (/strategy|strategic|thinking/.test(prompt)) {
    return `${gameName}: for when you want your brain to actually work for its entertainment.`;
  }
  
  if (/quick|fast|short/.test(prompt)) {
    return `${gameName}: maximum gaming satisfaction with minimum time commitment.`;
  }
  
  // Theme-based pitches
  if (theme?.includes('nature')) {
    return `${gameName}: eco-friendly gaming without the environmental guilt trips.`;
  }
  
  if (theme?.includes('economic')) {
    return `${gameName}: capitalism simulation for people who understand actual economics.`;
  }
  
  // Complexity-based pitches
  if (complexity && complexity <= 2.0) {
    return `${gameName}: elegantly simple without being insulting to your intelligence.`;
  }
  
  if (complexity && complexity >= 4.0) {
    return `${gameName}: brain-melting complexity for those who think they're ready.`;
  }
  
  // Default pitches
  const defaults = [
    `${gameName}: solid choice that won't disappoint your gaming standards.`,
    `${gameName}: the kind of game that earns its spot on your shelf.`,
    `${gameName}: quality gaming that respects both your time and intelligence.`,
    `${gameName}: delivers exactly what you're looking for without the usual BS.`
  ];
  
  return defaults[Math.floor(Math.random() * defaults.length)];
}

/**
 * Generate enhanced, context-aware pitches
 */
export async function POST(req: NextRequest) {
  let userPrompt = '';
  
  try {
    // Basic rate limiting
    const clientIP = req.ip || req.headers.get('x-forwarded-for') || 'localhost';
    const now = Date.now();
    const lastRequest = rateLimitMap.get(clientIP);
    
    if (lastRequest && now - lastRequest < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before making another request.' },
        { status: 429 }
      );
    }
    
    rateLimitMap.set(clientIP, now);
    
    const { prompt } = await req.json();
    userPrompt = prompt;
    
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json(
        { error: 'Valid prompt is required' }, 
        { status: 400 }
      );
    }

    console.log(`🎯 Enhanced recommendation request: "${userPrompt}"`);
    
    const response = await getEnhancedRecommendations(userPrompt);
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error in enhanced recommendation API:', error);
    
    return NextResponse.json(
      { error: 'Recommendation service temporarily unavailable' },
      { status: 500 }
    );
  }
}
