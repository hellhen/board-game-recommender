import { NextRequest, NextResponse } from 'next/server';
import { searchGames } from '../../../lib/database';

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ results: [] });
    }
    
    const games = await searchGames(query, 10);
    const results = games.map(game => ({ 
      id: game.id, 
      title: game.title,
      theme: game.theme,
      players: game.players,
      playtime: game.playtime,
      complexity: game.complexity
    }));
    
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error in search API:', error);
    return NextResponse.json({ results: [] });
  }
}
