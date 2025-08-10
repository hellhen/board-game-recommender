import { supabase } from './supabase';
import type { Game, UserRecommendation, GamePrice } from './supabase';

// Games
export async function getAllGames(): Promise<Game[]> {
  console.log('🔍 getAllGames() called - fetching all games with pagination');
  
  const allGames: Game[] = [];
  let from = 0;
  const batchSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    console.log(`🔍 Fetching batch: ${from} to ${from + batchSize - 1}`);
    
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .order('title')
      .range(from, from + batchSize - 1);
    
    if (error) {
      console.error(`Error fetching games batch ${from}-${from + batchSize - 1}:`, error);
      break;
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    allGames.push(...data);
    console.log(`🔍 Fetched ${data.length} games, total so far: ${allGames.length}`);
    
    // If we got less than the batch size, we've reached the end
    if (data.length < batchSize) {
      hasMore = false;
    } else {
      from += batchSize;
    }
  }
  
  console.log(`🔍 getAllGames() completed - returning ${allGames.length} games total`);
  
  return allGames;
}

export async function searchGames(query: string, limit: number = 10): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .or(`title.ilike.%${query}%,theme.ilike.%${query}%,tags.cs.{${query}}`)
    .limit(limit);
  
  if (error) {
    console.error('Error searching games:', error);
    return [];
  }
  
  return data || [];
}

export async function getGameById(id: string): Promise<Game | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    console.error('Error fetching game:', error);
    return null;
  }
  
  return data;
}

export async function getGamesByComplexity(minComplexity: number, maxComplexity: number): Promise<Game[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .gte('complexity', minComplexity)
    .lte('complexity', maxComplexity)
    .order('complexity');
  
  if (error) {
    console.error('Error fetching games by complexity:', error);
    return [];
  }
  
  return data || [];
}

// User Sessions and Recommendations
export async function createUserSession(fingerprint: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_sessions')
    .upsert({ 
      session_fingerprint: fingerprint,
      last_active: new Date().toISOString()
    })
    .select('id')
    .single();
  
  if (error) {
    console.error('Error creating user session:', error);
    return null;
  }
  
  return data.id;
}

export async function saveRecommendation(
  sessionId: string,
  userPrompt: string,
  recommendedGameIds: string[],
  llmResponse: any
): Promise<boolean> {
  const { error } = await supabase
    .from('user_recommendations')
    .insert({
      session_id: sessionId,
      user_prompt: userPrompt,
      recommended_games: recommendedGameIds,
      llm_response: llmResponse
    });
  
  if (error) {
    console.error('Error saving recommendation:', error);
    return false;
  }
  
  return true;
}

export async function updateRecommendationFeedback(
  recommendationId: string,
  rating: number,
  notes?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('user_recommendations')
    .update({
      feedback_rating: rating,
      feedback_notes: notes
    })
    .eq('id', recommendationId);
  
  if (error) {
    console.error('Error updating recommendation feedback:', error);
    return false;
  }
  
  return true;
}

// Game Prices
export async function getGamePrices(gameId: string): Promise<GamePrice[]> {
  const { data, error } = await supabase
    .from('game_prices')
    .select('*')
    .eq('game_id', gameId)
    .order('price');
  
  if (error) {
    console.error('Error fetching game prices:', error);
    return [];
  }
  
  return data || [];
}

export async function updateGamePrice(
  gameId: string,
  storeName: string,
  price: number,
  url: string
): Promise<boolean> {
  const { error } = await supabase
    .from('game_prices')
    .upsert({
      game_id: gameId,
      store_name: storeName,
      price,
      url,
      last_updated: new Date().toISOString()
    });
  
  if (error) {
    console.error('Error updating game price:', error);
    return false;
  }
  
  return true;
}
