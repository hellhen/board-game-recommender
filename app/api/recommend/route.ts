import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { ResponseSchema, SommelierResponse } from '../../../lib/schema';
import { getAllGames, searchGames } from '../../../lib/database';
import { SYSTEM_PROMPT } from '../../../lib/prompt';

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
  if (game.theme?.includes('nature')) {
    return `Listen, I know you think you're "unique" for loving nature games, but this one actually deserves your pretentious tree-hugging attention.`;
  }
  if (game.tags?.includes('party')) {
    return `This will turn your awkward gathering into pure chaos—the good kind that makes people forget you're usually boring at parties.`;
  }
  if (game.complexity && game.complexity >= 3.5) {
    return `Finally, something that won't insult your supposedly massive brain. Prepare to discover you're not as strategic as you think.`;
  }
  if (/family|parent|kid/.test(prompt.toLowerCase())) {
    return `Your kids will love it, you'll tolerate it, and somehow everyone wins. Miraculous, really.`;
  }
  if (/date|couple|romantic/.test(prompt.toLowerCase())) {
    return `This will either bring you closer together or reveal exactly how competitive and petty you both are. Either way, entertaining.`;
  }
  return `Look, I could give you some generic fluff, but honestly? This game is going to surprise you in ways your basic gaming palate isn't ready for.`;
}

// Smart pre-filtering to reduce dataset size
function filterRelevantGames(games: any[], prompt: string, limit: number = 25): any[] {
  const p = prompt.toLowerCase();
  
  // Score games for relevance
  const scored = games.map(game => ({
    ...game,
    relevanceScore: calculateRelevanceScore(game, p)
  }));
  
  // Sort by relevance and take the top matches
  return scored
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

function calculateRelevanceScore(game: any, prompt: string): number {
  let score = 0;
  
  // Theme matching
  if (game.theme && prompt.includes(game.theme.toLowerCase())) score += 3;
  if (game.title && prompt.includes(game.title.toLowerCase())) score += 5;
  
  // Tags matching
  if (game.tags) {
    game.tags.forEach((tag: string) => {
      if (prompt.includes(tag.toLowerCase())) score += 2;
    });
  }
  
  // Mechanics matching
  if (game.mechanics) {
    game.mechanics.forEach((mechanic: string) => {
      if (prompt.includes(mechanic.replace('-', ' '))) score += 1;
    });
  }
  
  // Complexity preferences
  if (/family|easy|light|simple/.test(prompt) && game.complexity && game.complexity <= 2.5) score += 2;
  if (/heavy|complex|deep|strategic/.test(prompt) && game.complexity && game.complexity >= 3.5) score += 2;
  
  return score;
}

export async function POST(req: NextRequest) {
  let userPrompt = '';
  
  try {
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

    if (!openaiApiKey || openaiApiKey === 'your_openai_api_key_here') {
      console.log('No OpenAI API key found, using fallback');
      const fallbackResponse = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(fallbackResponse);
    }

    // Get games from Supabase for context
    const allGames = await getAllGames();
    
    if (allGames.length === 0) {
      return NextResponse.json({
        error: 'No games found in database. Please populate the games table first.'
      }, { status: 500 });
    }

    // Pre-filter games for relevance to improve speed and accuracy
    const relevantGames = filterRelevantGames(allGames, userPrompt, 25);
    
    // Prepare games context for the LLM (smaller, more relevant sample)
    const gamesContext = relevantGames.map(game => ({
      id: game.id,
      title: game.title,
      players: game.players,
      playtime: game.playtime,
      complexity: game.complexity,
      mechanics: game.mechanics?.slice(0, 3), // Limit mechanics
      theme: game.theme,
      tags: game.tags?.slice(0, 3) // Limit tags
    }));

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Generate LLM response with optimized settings
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Fast, cost-effective model
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `User request: "${userPrompt}"

Available games (sample):
${JSON.stringify(gamesContext)}

Recommend 3 games from this list that best match the request. Respond with valid JSON.` 
        }
      ],
      temperature: 0.7, // Slightly more deterministic for speed
      max_tokens: 1500, // Limit response size
      response_format: { type: 'json_object' }
    });

    let parsedResponse: SommelierResponse;
    try {
      const responseText = completion.choices[0]?.message?.content || '{}';
      parsedResponse = JSON.parse(responseText) as SommelierResponse;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response, using fallback');
      const fallbackResponse = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(fallbackResponse);
    }

    // Validate the response structure
    const validationResult = ResponseSchema.safeParse(parsedResponse);
    if (!validationResult.success) {
      console.error('Invalid response schema, using fallback');
      const fallbackResponse = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(fallbackResponse);
    }

    // Validate that recommended games exist in database
    const validatedRecommendations = [];
    for (const rec of validationResult.data.recommendations) {
      // Check both relevant games and all games
      const gameExists = relevantGames.find(g => g.id === rec.id || g.title === rec.title) ||
                        allGames.find(g => g.id === rec.id || g.title === rec.title);
      if (gameExists) {
        validatedRecommendations.push({
          ...rec,
          id: gameExists.id || '',
          specs: {
            players: gameExists.players || rec.specs.players,
            playtime: gameExists.playtime || rec.specs.playtime,
            complexity: gameExists.complexity ?? rec.specs.complexity
          }
        });
      }
    }

    // If we don't have enough valid recommendations, fall back
    if (validatedRecommendations.length < 2) {
      console.log('LLM returned insufficient valid games, using fallback');
      const fallbackResponse = await getFallbackRecommendations(userPrompt);
      return NextResponse.json(fallbackResponse);
    }

    const response: SommelierResponse = {
      ...validationResult.data,
      recommendations: validatedRecommendations
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in recommendation API:', error);
    
    // Fall back to local recommendations on any error
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
