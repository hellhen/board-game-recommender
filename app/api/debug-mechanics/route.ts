/**
 * Simple debugging tool for testing specific mechanic queries
 * Usage: npm run dev, then visit /api/debug-mechanics?q=simultaneous+turns
 */

import { NextRequest, NextResponse } from 'next/server';
import { intelligentGameSearch, getAllMechanics } from '../../../lib/enhanced-database';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || 'worker placement games';
    
    console.log(`🔍 Debug query: "${query}"`);
    
    // Get search results
    const result = await intelligentGameSearch(query, 20);
    
    // Get all available mechanics for reference
    const allMechanics = await getAllMechanics();
    
    const response = {
      query,
      results: {
        foundGames: result.games.length,
        matchType: result.matchType,
        requestedMechanics: result.requestedMechanics,
        games: result.games.slice(0, 5).map(game => ({
          title: game.title,
          mechanics: game.mechanics || [],
          theme: game.theme,
          complexity: game.complexity
        }))
      },
      databaseInfo: {
        totalMechanics: allMechanics.length,
        sampleMechanics: allMechanics.slice(0, 20),
        mechanicsWithKeyword: allMechanics.filter(mech => 
          mech.toLowerCase().includes(query.toLowerCase().split(' ')[0])
        )
      }
    };
    
    return NextResponse.json(response, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      { error: 'Debug endpoint failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Also support POST for testing complex queries
export async function POST(req: NextRequest) {
  try {
    const { query, limit = 20 } = await req.json();
    
    if (!query) {
      return NextResponse.json(
        { error: 'Query required' },
        { status: 400 }
      );
    }
    
    console.log(`🔍 Debug POST query: "${query}"`);
    
    const result = await intelligentGameSearch(query, limit);
    const allMechanics = await getAllMechanics();
    
    return NextResponse.json({
      query,
      searchResult: result,
      availableMechanics: allMechanics
    });
    
  } catch (error) {
    console.error('Debug POST error:', error);
    return NextResponse.json(
      { error: 'Debug failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
