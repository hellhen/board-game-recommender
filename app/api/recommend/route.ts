import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { ResponseSchema, SommelierResponse } from '@/lib/schema';
import { getAllGames, searchGames } from '@/lib/database';
import { SYSTEM_PROMPT } from '@/lib/prompt';

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
    return `A serene nature-themed experience that'll scratch that Cascadia itch without overwhelming anyone.`;
  }
  if (game.tags?.includes('party')) {
    return `Pure social gold – easy to teach, impossible to stop laughing at.`;
  }
  if (game.complexity && game.complexity >= 3.5) {
    return `A deliciously crunchy puzzle that transforms decision-making into an art form.`;
  }
  return `A perfectly balanced gem that delivers exactly what your table needs tonight.`;
}

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();
    
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
      const fallbackResponse = await getFallbackRecommendations(prompt);
      return NextResponse.json(fallbackResponse);
    }

    // Get games from Supabase for context
    const allGames = await getAllGames();
    
    if (allGames.length === 0) {
      return NextResponse.json({
        error: 'No games found in database. Please populate the games table first.'
      }, { status: 500 });
    }

    // Prepare games context for the LLM (sample of games to avoid token limits)
    const gamesSample = allGames.slice(0, 50); // Limit to prevent token overflow
    const gamesContext = gamesSample.map(game => ({
      id: game.id,
      title: game.title,
      players: game.players,
      playtime: game.playtime,
      complexity: game.complexity,
      mechanics: game.mechanics,
      theme: game.theme,
      tags: game.tags
    }));

    // Initialize OpenAI
    const openai = new OpenAI({
      apiKey: openaiApiKey,
    });

    // Generate LLM response
    const completion = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { 
          role: 'user', 
          content: `User request: "${prompt}"

Available games in database (sample):
${JSON.stringify(gamesContext, null, 2)}

Please recommend 3 games from this database that best match the user's request. Use the exact game IDs from the database. Respond with valid JSON matching the expected schema.` 
        }
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });

    let parsedResponse: SommelierResponse;
    try {
      const responseText = completion.choices[0]?.message?.content || '{}';
      parsedResponse = JSON.parse(responseText) as SommelierResponse;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response, using fallback');
      return NextResponse.json(await getFallbackRecommendations(prompt));
    }

    // Validate the response structure
    const validationResult = ResponseSchema.safeParse(parsedResponse);
    if (!validationResult.success) {
      console.error('Invalid response schema, using fallback');
      return NextResponse.json(await getFallbackRecommendations(prompt));
    }

    // Validate that recommended games exist in database
    const validatedRecommendations = [];
    for (const rec of validationResult.data.recommendations) {
      const gameExists = allGames.find(g => g.id === rec.id || g.title === rec.title);
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
      const fallbackResponse = await getFallbackRecommendations(prompt);
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
      const fallbackResponse = await getFallbackRecommendations(prompt);
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
