import { NextRequest, NextResponse } from 'next/server';
import { priceService } from '../../../lib/price-service';
import { getClientIdentifier } from '../../../lib/rate-limit';
import { logError } from '../../../lib/security-logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get('gameId');
    const gameIds = searchParams.get('gameIds'); // Comma-separated list
    const action = searchParams.get('action');

    // Handle different types of requests
    if (action === 'stats') {
      const stats = await priceService.getPriceStatistics();
      return NextResponse.json(stats);
    }

    if (action === 'needs-update') {
      const games = await priceService.findGamesNeedingPriceUpdates();
      return NextResponse.json({ games, count: games.length });
    }

    if (gameId) {
      // Single game prices
      const prices = await priceService.getGamePrices(gameId);
      return NextResponse.json({ gameId, prices });
    }

    if (gameIds) {
      // Multiple games prices
      const ids = gameIds.split(',').filter(id => id.trim());
      const gamesWithPrices = await priceService.getGamesWithPrices(ids);
      return NextResponse.json({ games: gamesWithPrices });
    }

    return NextResponse.json(
      { error: 'Missing required parameters. Use gameId, gameIds, or action parameter.' },
      { status: 400 }
    );

  } catch (error) {
    logError(getClientIdentifier(req), '/api/prices', error);
    console.error('Error in prices API:', error);
    
    return NextResponse.json(
      { error: 'Price service temporarily unavailable' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { gameId, gameTitle, gameIds, action, forceUpdate } = await req.json();

    if (action === 'update-single' && gameId && gameTitle) {
      // Update single game
      const success = await priceService.updateGamePrices(gameId, gameTitle, forceUpdate);
      
      if (success) {
        const prices = await priceService.getGamePrices(gameId);
        return NextResponse.json({ 
          success: true, 
          message: `Updated prices for ${gameTitle}`,
          prices 
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: `Failed to update prices for ${gameTitle}` 
        });
      }
    }

    if (action === 'update-bulk' && gameIds && Array.isArray(gameIds)) {
      // Validate input
      const games = gameIds.filter(game => game.id && game.title);
      if (games.length === 0) {
        return NextResponse.json(
          { error: 'Invalid gameIds format. Expected array of {id, title} objects.' },
          { status: 400 }
        );
      }

      // Start bulk update (this could take a while)
      const successCount = await priceService.updateBulkGamePrices(games);
      
      return NextResponse.json({ 
        success: true,
        message: `Updated ${successCount}/${games.length} games`,
        updatedCount: successCount,
        totalCount: games.length
      });
    }

    if (action === 'cleanup') {
      const olderThanDays = parseInt(req.nextUrl.searchParams.get('days') || '30');
      const cleanedCount = await priceService.cleanupOldPrices(olderThanDays);
      
      return NextResponse.json({
        success: true,
        message: `Cleaned up ${cleanedCount} old price records`,
        cleanedCount
      });
    }

    return NextResponse.json(
      { error: 'Invalid action or missing parameters' },
      { status: 400 }
    );

  } catch (error) {
    logError(getClientIdentifier(req), '/api/prices', error);
    console.error('Error in prices POST API:', error);
    
    return NextResponse.json(
      { error: 'Price update service temporarily unavailable' },
      { status: 500 }
    );
  }
}
