import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { ResponseSchema, SommelierResponse } from '../../../lib/schema';
import { getAllGames, searchGames } from '../../../lib/database';
import { supabase } from '../../../lib/supabase';
import { SYSTEM_PROMPT } from '../../../lib/prompt';

// Simple rate limiting - store last request times by IP
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 10000; // 10 seconds between requests per IP

// Helper function to find a game in the database with fuzzy matching
async function findGameInDatabase(aiTitle: string, allGames: any[]): Promise<{game: any, matchType: string} | null> {
  const normalizeTitle = (title: string) => 
    title.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();

  const normalizedAiTitle = normalizeTitle(aiTitle);
  console.log(`🔍 Searching for: "${aiTitle}" (normalized: "${normalizedAiTitle}")`);
  
  // Special debug for Patchwork
  if (normalizedAiTitle.toLowerCase().includes('patchwork')) {
    console.log('🎯 PATCHWORK DEBUG - Searching for Patchwork variants');
    
    // Direct database query for Patchwork
    try {
      const { data: patchworkGames, error } = await supabase
        .from('games')
        .select('id, title')
        .ilike('title', '%patchwork%');
      
      if (patchworkGames && patchworkGames.length > 0) {
        console.log('🎯 Found Patchwork games in database:');
        patchworkGames.forEach((game: any) => {
          console.log(`  ID: ${game.id}, Title: "${game.title}", Normalized: "${normalizeTitle(game.title)}"`);
        });
      } else {
        console.log('🎯 No Patchwork games found in direct database query');
        if (error) console.log('🎯 Database error:', error);
      }
    } catch (dbError) {
      console.log('🎯 Database query failed:', dbError);
    }
  }
  
  console.log(`🔢 Total games in allGames array: ${allGames.length}`);
  console.log(`📋 First 3 game titles for comparison:`);
  allGames.slice(0, 3).forEach((game, index) => {
    console.log(`  ${index + 1}. "${game.title}" -> normalized: "${normalizeTitle(game.title)}"`);
  });
  
  // Try exact match first
  let match = allGames.find(game => 
    normalizeTitle(game.title) === normalizedAiTitle
  );
  
  if (match) {
    console.log(`✅ Exact match found: "${match.title}"`);
    return { game: match, matchType: 'exact' };
  }
  
  // Try case-insensitive exact match
  match = allGames.find(game => 
    game.title.toLowerCase() === aiTitle.toLowerCase()
  );
  
  if (match) {
    console.log(`✅ Case-insensitive exact match found: "${match.title}"`);
    return { game: match, matchType: 'exact' };
  }
  
  // Try partial matches - but be very strict to avoid false positives
  match = allGames.find(game => {
    const normalizedDbTitle = normalizeTitle(game.title);
    const aiWords = normalizedAiTitle.split(' ');
    const dbWords = normalizedDbTitle.split(' ');
    
    // Only allow partial matches if:
    // 1. AI title is longer and completely contains DB title as separate words
    // 2. Or DB title is longer and completely contains AI title as separate words
    // 3. And both titles have at least 2 words to avoid single-letter matches
    
    if (aiWords.length >= 2 && dbWords.length >= 2) {
      // Check if AI title contains all words from DB title (like "7 Wonders Duel" contains "7 Wonders")
      const dbWordsInAi = dbWords.every(dbWord => aiWords.includes(dbWord));
      
      // Check if DB title contains all words from AI title 
      const aiWordsInDb = aiWords.every(aiWord => dbWords.includes(aiWord));
      
      return dbWordsInAi || aiWordsInDb;
    }
    
    // For single-word titles, only allow exact matches to avoid "Ra" matching "Literary"
    return false;
  });
  
  if (match) {
    console.log(`✅ Strict partial match found: "${match.title}"`);
    return { game: match, matchType: 'partial' };
  }
  
  // Try single word match for simple games like "Patchwork"
  if (normalizedAiTitle.split(' ').length === 1) {
    // For single words, only do exact matches - be very strict
    match = allGames.find(game => {
      const normalizedDbTitle = normalizeTitle(game.title);
      return normalizedDbTitle === normalizedAiTitle;
    });
    
    if (match) {
      console.log(`✅ Single word exact match found: "${match.title}"`);
      return { game: match, matchType: 'exact' };
    }
    
    // If no exact match, try starting with the word (for cases like "Patchwork: Doodle")
    match = allGames.find(game => {
      const normalizedDbTitle = normalizeTitle(game.title);
      return normalizedDbTitle.startsWith(normalizedAiTitle + ' ') || // "patchwork doodle"
             normalizedDbTitle.startsWith(normalizedAiTitle + ':');    // "patchwork: doodle"
    });
    
    if (match) {
      console.log(`✅ Single word prefix match found: "${match.title}"`);
      return { game: match, matchType: 'partial' };
    }
    
    console.log(`❌ No valid single word match found for "${normalizedAiTitle}"`);
    return null; // Don't try other matching for single words - be strict
  }
  
  // Try word-by-word matching for games with subtitles - BE VERY STRICT
  const aiWords = normalizedAiTitle.split(' ').filter(word => word.length > 2); // Skip short words like "a", "in", "the"
  
  if (aiWords.length >= 2) { // Only try word matching for multi-word titles
    const dbMatches = allGames.filter(game => {
      const dbWords = normalizeTitle(game.title).split(' ').filter(word => word.length > 2);
      const commonWords = aiWords.filter(word => dbWords.includes(word));
      
      // Require at least 70% of words to match AND at least 2 words
      const matchRatio = commonWords.length / aiWords.length;
      return matchRatio >= 0.7 && commonWords.length >= 2;
    });
    
    if (dbMatches.length > 0) {
      // Sort by best match ratio
      const sortedMatches = dbMatches.sort((a, b) => {
        const aWords = normalizeTitle(a.title).split(' ').filter(word => word.length > 2);
        const bWords = normalizeTitle(b.title).split(' ').filter(word => word.length > 2);
        const aCommon = aiWords.filter(word => aWords.includes(word)).length;
        const bCommon = aiWords.filter(word => bWords.includes(word)).length;
        const aRatio = aCommon / aiWords.length;
        const bRatio = bCommon / aiWords.length;
        return bRatio - aRatio;
      });
      
      const bestMatch = sortedMatches[0];
      const bestWords = normalizeTitle(bestMatch.title).split(' ').filter(word => word.length > 2);
      const bestCommon = aiWords.filter(word => bestWords.includes(word));
      const bestRatio = bestCommon.length / aiWords.length;
      
      console.log(`✅ Word-based match found: "${bestMatch.title}" (${bestCommon.length}/${aiWords.length} words = ${(bestRatio * 100).toFixed(0)}%)`);
      return { game: bestMatch, matchType: 'word-based' };
    }
  }
  
  console.log(`❌ No match found for: "${aiTitle}"`);
  return null;
}

// Helper function to generate varied sassy pitches - Fallback when AI doesn't provide one
function generateSassyPitch(dbGame: any, reasoning: string, userPrompt: string): string {
  // Create a game-specific pitch using available information
  const gameName = dbGame.title || 'this game';
  const mechanics = dbGame.mechanics?.slice(0, 2).join(' and ') || 'pure strategy';
  
  const pitches = [
    `${gameName} delivers ${mechanics} without the pretentious complexity you secretly fear.`,
    `Time to discover why ${gameName} has been quietly dominating game nights while you chased the new hotness.`,
    `${gameName}: where ${mechanics} meets your actual attention span - perfectly balanced.`,
    `Stop overthinking it - ${gameName} is exactly the ${mechanics} experience you've been avoiding.`,
    `${gameName} proves that great ${mechanics} doesn't need a PhD in rules interpretation.`,
    `Finally, ${mechanics} done right - ${gameName} won't make you question your life choices.`,
    `${gameName}: the thinking person's approach to ${mechanics} without the analysis paralysis.`,
    `Your game shelf has been secretly hoping you'd notice ${gameName} all along.`,
    `${gameName} cuts through the ${mechanics} noise with surgical precision and zero BS.`,
    `This is what ${mechanics} looks like when designers actually understand fun.`
  ];
  
  const randomIndex = Math.floor(Math.random() * pitches.length);
  return pitches[randomIndex];
}

// Helper function to build the final sommelier response
function buildSommelierResponse(matchedGames: any[], userPrompt: string, availableGames: any[]): SommelierResponse {
  const recommendations = matchedGames.map(({ aiRecommendation, dbGame }) => {
    // Check for AI-generated sommelier pitch in the response
    const hasAIPitch = aiRecommendation.sommelierPitch && aiRecommendation.sommelierPitch.length > 0;
    console.log(`🔍 ${dbGame.title}: AI pitch available? ${hasAIPitch ? 'Yes' : 'No'}`);
    console.log(`🔍 AI recommendation structure keys:`, Object.keys(aiRecommendation));
    if (hasAIPitch) {
      console.log(`🎯 AI Sommelier Pitch: "${aiRecommendation.sommelierPitch}"`);
    }
    
    return {
      id: dbGame.id || '',
      title: dbGame.title,
      sommelierPitch: hasAIPitch ? aiRecommendation.sommelierPitch : generateSassyPitch(dbGame, aiRecommendation.reasoning, userPrompt),
      whyItFits: aiRecommendation.whyItFits || [
        aiRecommendation.reasoning,
        `Mechanics: ${aiRecommendation.mechanics?.join(', ') || 'Classic gameplay'}`,
        `Perfect for your situation: ${aiRecommendation.players} players, ${aiRecommendation.playtime}`
      ],
      specs: {
        players: dbGame.players || aiRecommendation.players || null,
        playtime: dbGame.playtime || aiRecommendation.playtime || null,
        complexity: dbGame.complexity ?? aiRecommendation.complexity ?? null
      },
      mechanics: dbGame.mechanics || aiRecommendation.mechanics || [],
      theme: dbGame.theme || 'Various',
      price: { amount: null, store: null, url: null },
      alternates: [] // Could populate with other matched games
    };
  });

  const followUps = availableGames.length > 0 ? 
    [`I also wanted to recommend ${availableGames[0]?.title}, but it's not in the database - want me to find similar options?`] : 
    [];

  return {
    followUps,
    recommendations,
    metadata: {
      interpretedNeeds: [userPrompt.toLowerCase().replace(/[^\w\s]/g, '').split(' ').slice(0, 3).join('-')],
      notes: `Found ${matchedGames.length} perfect matches from AI recommendations. Using real game expertise instead of basic keyword matching.`
    }
  };
}

// Fallback function for when OpenAI is not available
async function getFallbackRecommendations(prompt: string): Promise<SommelierResponse> {
  console.log('Using fallback recommendations (no OpenAI key)');
  
  // Get all games from Supabase
  const allGames = await getAllGames();
  
  if (allGames.length === 0) {
    return {
      followUps: [],
      recommendations: [],
      metadata: {
        interpretedNeeds: [],
        notes: "No games found in database. Please populate the games table first."
      }
    };
  }

  // Simple scoring logic (similar to the old approach but using Supabase data)
  const games = allGames.map(game => ({
    ...game,
    score: scoreGame(prompt, game)
  }));
  
  games.sort((a, b) => b.score - a.score);
  
  const picks = games.slice(0, 3).map(game => ({
    id: game.id || '',
    title: game.title,
    sommelierPitch: generateFallbackPitch(prompt, game),
    whyItFits: [
      game.theme ? `Theme: ${game.theme}` : 'Matches your stated preferences',
      `Mechanics: ${game.mechanics?.slice(0, 2).join(', ') || 'Various gameplay elements'}`,
      `Playtime: ${game.playtime || 'Variable'}, Complexity: ${game.complexity || 'TBD'}`
    ],
    specs: {
      players: game.players || null,
      playtime: game.playtime || null,
      complexity: game.complexity ?? null
    },
    mechanics: game.mechanics || [],
    theme: game.theme || '',
    price: { amount: null, store: null, url: null },
    alternates: games.slice(3, 6).map(g => g.id || '')
  }));

  return {
    followUps: [],
    recommendations: picks,
    metadata: {
      interpretedNeeds: ["fallback-mode"],
      notes: "Using local heuristics. Add OpenAI API key for enhanced recommendations."
    }
  };
}

function scoreGame(prompt: string, game: any): number {
  const p = prompt.toLowerCase();
  let score = 0;
  
  // Theme matching
  if (game.theme && p.includes(game.theme.toLowerCase())) score += 3;
  if (game.theme?.includes('nature') && /cascadia|nature|parks|meadow/.test(p)) score += 2;
  
  // Complexity preferences
  if (/family|parents|easy|light/.test(p) && game.complexity && game.complexity <= 2.5) score += 2;
  if (/heavy|complex|strategic|deep/.test(p) && game.complexity && game.complexity >= 3.5) score += 2;
  if (/party|social|group/.test(p) && game.tags?.includes('party')) score += 2;
  
  // Mechanics matching
  if (game.mechanics) {
    game.mechanics.forEach((mechanic: string) => {
      if (p.includes(mechanic.replace('-', ' '))) score += 1;
    });
  }
  
  return score;
}

function generateFallbackPitch(prompt: string, game: any): string {
  const contextualPitches = [];
  
  // Add context-specific options
  if (game.theme?.includes('nature')) {
    contextualPitches.push(
      `Your eco-conscious gaming deserves something better than guilt trips.`,
      `Nature themes done right without the preachy environmental lectures.`
    );
  }
  if (game.tags?.includes('party')) {
    contextualPitches.push(
      `Your social gatherings need this kind of controlled chaos.`,
      `Party gaming that actually works for more than five minutes.`
    );
  }
  if (game.complexity && game.complexity >= 3.5) {
    contextualPitches.push(
      `Brain-burning strategy for people who think they're actually strategic.`,
      `This will test your limits and probably humble you.`
    );
  }
  if (/family|parent|kid/.test(prompt.toLowerCase())) {
    contextualPitches.push(
      `Family bonding without the usual educational torture sessions.`,
      `Kids and adults both win here - miraculous, really.`
    );
  }
  if (/date|couple|romantic/.test(prompt.toLowerCase())) {
    contextualPitches.push(
      `Date night just got significantly more interesting and revealing.`,
      `Perfect relationship stress-test disguised as innocent fun.`
    );
  }
  
  // Default options
  const defaultPitches = [
    `This game deserves your attention more than you realize.`,
    `Sometimes the simple recommendation is exactly what you need.`,
    `Quality choice that won't disappoint your gaming sensibilities.`,
    `This will surprise you in all the right ways.`,
    `Solid design that actually delivers on its promises.`,
    `Your gaming instincts are pointing you in the right direction.`,
    `This earns its table time through pure quality.`,
    `Smart pick for people with discerning gaming taste.`,
    `This cuts through the noise of trendy releases beautifully.`,
    `Your collection has been waiting for exactly this game.`
  ];
  
  const allPitches = [...contextualPitches, ...defaultPitches];
  const randomIndex = Math.floor(Math.random() * allPitches.length);
  return allPitches[randomIndex];
}

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

    // Check if OpenAI is available
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const model = process.env.MODEL || 'gpt-4o-mini';

    console.log('OpenAI API Key present:', !!openaiApiKey);
    console.log('OpenAI API Key length:', openaiApiKey?.length || 0);
    console.log('Using model:', model);

    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.log('No OpenAI API key found, using fallback');
      const fallbackResponse = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(fallbackResponse);
    }

    // Get games from database for cross-reference
    console.log('🔍 DEBUG: Calling getAllGames()...');
    const allGames = await getAllGames();
    console.log(`🔍 DEBUG: getAllGames() returned ${allGames.length} games`);
    
    // TEMPORARY: Try direct query with explicit limit
    console.log('🔍 DEBUG: Trying direct supabase query...');
    const { data: directGames, error: directError } = await supabase
      .from('games')
      .select('*')
      .order('title')
      .limit(10000);
    
    if (directError) {
      console.error('🔍 DEBUG: Direct query error:', directError);
    } else {
      console.log(`🔍 DEBUG: Direct query returned ${directGames?.length || 0} games`);
    }
    
    console.log('Total games in database for cross-reference:', allGames.length);
    
    // Debug: Check if Patchwork is in the database
    const patchworkVariants = allGames.filter(game => 
      game.title.toLowerCase().includes('patchwork')
    );
    if (patchworkVariants.length > 0) {
      console.log('Patchwork variants found in DB:', patchworkVariants.map(g => `"${g.title}"`));
    } else {
      console.log('No Patchwork variants found in database');
      // Show first 10 game titles for reference
      console.log('Sample game titles:', allGames.slice(0, 10).map(g => `"${g.title}"`));
    }
    
    if (allGames.length === 0) {
      return NextResponse.json({
        error: 'No games found in database. Please populate the games table first.'
      }, { status: 500 });
    }

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Simple user prompt that lets the system prompt handle the heavy lifting
    const aiPrompt = `User request: "${userPrompt}"

Please analyze this request and recommend 8 games that would be perfect for this user. Focus on providing a variety of options that match the request. You must respond with valid JSON following the exact schema specified in your system prompt. Make sure to include the "sommelierPitch" field for each recommendation.`;

    console.log('Calling OpenAI for game recommendations...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: aiPrompt }
      ],
      temperature: 0.8,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    console.log('OpenAI response received');
    
    let aiRecommendations;
    try {
      const responseText = completion.choices[0]?.message?.content || '{}';
      aiRecommendations = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      const fallbackResponse = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(fallbackResponse);
    }

    console.log('AI recommended games:', aiRecommendations.recommendations?.map((r: any) => r.title));
    console.log('🔍 DEBUG: Sample AI recommendation structure:', JSON.stringify(aiRecommendations.recommendations?.[0], null, 2));

    // Cross-reference AI recommendations with our database
    const matchedGames = [];
    const availableGames = [];
    
    for (const aiRec of aiRecommendations.recommendations || []) {
      // Try to find this game in our database
      const dbResult = await findGameInDatabase(aiRec.title, allGames);
      
      if (dbResult) {
        console.log(`✅ Found "${aiRec.title}" in database as "${dbResult.game.title}" (${dbResult.matchType} match)`);
        matchedGames.push({
          aiRecommendation: aiRec,
          dbGame: dbResult.game,
          matchType: dbResult.matchType
        });
      } else {
        console.log(`❌ "${aiRec.title}" not found in database`);
        availableGames.push(aiRec);
      }
    }

    console.log(`Matched ${matchedGames.length} games from database`);

    // If we have enough matches, prioritize by match quality
    if (matchedGames.length >= 3) {
      // Sort matches by quality: exact > partial > word-based
      const matchPriority: { [key: string]: number } = { 'exact': 1, 'partial': 2, 'word-based': 3 };
      const sortedMatches = matchedGames.sort((a, b) => {
        const aPriority = matchPriority[a.matchType] || 999;
        const bPriority = matchPriority[b.matchType] || 999;
        return aPriority - bPriority;
      });
      
      console.log(`🎯 Prioritized matches: ${sortedMatches.map(m => `"${m.dbGame.title}" (${m.matchType})`).join(', ')}`);
      
      const topMatches = sortedMatches.slice(0, 3);
      const response = buildSommelierResponse(topMatches, userPrompt, availableGames);
      return NextResponse.json(response);
    }

    // If we don't have enough matches, ask AI to recommend from our specific database
    console.log('Not enough matches, asking AI to pick from our database...');
    
    // Create a simplified game list for AI to choose from
    const gamesList = allGames.map(game => ({
      title: game.title,
      mechanics: game.mechanics?.slice(0, 3),
      theme: game.theme,
      players: game.players,
      playtime: game.playtime,
      complexity: game.complexity
    })).slice(0, 200); // Limit to 200 games to save tokens

    const fallbackPrompt = `The user requested: "${userPrompt}"

I recommended some great games, but they're not in this database. Please pick 3 games from this specific database that best match the request:

${JSON.stringify(gamesList)}

Respond with JSON matching the exact schema from your system prompt.`;

    const fallbackCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fallbackPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: 'json_object' }
    });

    let fallbackResponse: SommelierResponse;
    try {
      const responseText = fallbackCompletion.choices[0]?.message?.content || '{}';
      const aiResponse = JSON.parse(responseText);
      
      // Log what we got from AI
      console.log('🔍 Fallback AI response structure:', Object.keys(aiResponse));
      console.log('🔍 Fallback recommendations count:', aiResponse.recommendations?.length || 0);
      
      // Transform AI response into our expected structure
      if (aiResponse.recommendations && Array.isArray(aiResponse.recommendations)) {
        const matchedGames = [];
        
        for (const aiRec of aiResponse.recommendations) {
          try {
            const dbResult = await findGameInDatabase(aiRec.title, allGames);
            if (dbResult) {
              console.log(`✅ Fallback found "${aiRec.title}" as "${dbResult.game.title}"`);
              matchedGames.push({
                aiRecommendation: aiRec,
                dbGame: dbResult.game,
                matchType: dbResult.matchType
              });
            } else {
              console.log(`❌ Fallback could not find "${aiRec.title}"`);
            }
          } catch (error) {
            console.error(`Error finding game "${aiRec.title}":`, error);
          }
        }
        
        if (matchedGames.length >= 3) {
          const response = buildSommelierResponse(matchedGames.slice(0, 3), userPrompt, []);
          return NextResponse.json(response);
        }
      }
      
      console.error('Fallback AI response insufficient - falling back to simple recommendations');
      const simpleFallback = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(simpleFallback);
    } catch (parseError) {
      console.error('Failed to parse fallback response:', parseError);
      const simpleFallback = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(simpleFallback);
    }

  } catch (error) {
    console.error('Error in recommendation API:', error);
    
    try {
      const fallbackResponse = await getFallbackRecommendations(userPrompt || 'general recommendation');
      return NextResponse.json(fallbackResponse);
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      return NextResponse.json(
        { error: 'Recommendation service temporarily unavailable' },
        { status: 500 }
      );
    }
  }
}