import { NextRequest, NextResponse } from 'next/server';
import { securityLogger } from '@/lib/security-logger';

/**
 * Security monitoring endpoint - should be protected in production!
 */
export async function GET(req: NextRequest) {
  try {
    // In production, add authentication here:
    // - Check API key
    // - Verify admin permissions
    // - Rate limit this endpoint heavily
    
    const url = new URL(req.url);
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '3600000'); // Default 1 hour
    const clientId = url.searchParams.get('clientId');
    
    if (clientId) {
      // Get events for a specific client
      const events = securityLogger.getClientEvents(clientId, 100);
      return NextResponse.json({ 
        clientId: clientId.substring(0, 12) + '...',
        events: events.map(event => ({
          ...event,
          clientId: event.clientId.substring(0, 12) + '...' // Redact full client ID
        }))
      });
    }
    
    // Get overall stats
    const stats = securityLogger.getStats(timeWindow);
    
    return NextResponse.json({
      timeWindow: `${timeWindow / 1000 / 60} minutes`,
      timestamp: new Date().toISOString(),
      ...stats
    });
    
  } catch (error) {
    console.error('Error in security monitor API:', error);
    return NextResponse.json(
      { error: 'Monitoring service unavailable' },
      { status: 500 }
    );
  }
}
