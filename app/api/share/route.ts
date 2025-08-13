import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';
import { cleanupOldShares } from '@/lib/share-cleanup';
import { shareRateLimit, getClientIdentifier } from '@/lib/rate-limit';
import { logRateLimit, logLargePayload, logInvalidInput, logError } from '@/lib/security-logger';

// Schema for creating a shared recommendation
const CreateShareSchema = z.object({
  prompt: z.string().min(1),
  recommendations: z.array(z.any()), // The recommendation objects
  metadata: z.any().optional(),
  title: z.string().optional(),
});

// Directory to store shared recommendations
const SHARES_DIR = path.join(process.cwd(), 'data', 'shares');

/**
 * POST /api/share - Create a shareable recommendation using file storage
 */
export async function POST(req: NextRequest) {
  try {
    // Advanced rate limiting for share creation
    const clientId = getClientIdentifier(req);
    const rateLimitResult = shareRateLimit.check(clientId);
    
    if (!rateLimitResult.allowed) {
      logRateLimit(clientId, '/api/share', { 
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime 
      });
      
      return NextResponse.json(
        { 
          error: 'Share creation rate limit exceeded. Please wait before sharing again.',
          resetTime: new Date(rateLimitResult.resetTime).toISOString()
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
          }
        }
      );
    }
    
    // Check content length to prevent large payloads
    const contentLength = req.headers.get('content-length');
    const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB limit
    
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      logLargePayload(clientId, '/api/share', parseInt(contentLength));
      
      return NextResponse.json(
        { error: 'Payload too large. Maximum size is 1MB.' },
        { status: 413 }
      );
    }
    
    const body = await req.json();
    
    // Validate recommendations array size
    if (body.recommendations && Array.isArray(body.recommendations) && body.recommendations.length > 10) {
      return NextResponse.json(
        { error: 'Too many recommendations. Maximum 10 allowed.' },
        { status: 400 }
      );
    }
    
    const validatedData = CreateShareSchema.parse(body);
    
    const { prompt, recommendations, metadata, title } = validatedData;
    
    // Ensure shares directory exists
    try {
      await fs.mkdir(SHARES_DIR, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
    
    // Generate unique share ID
    let shareId: string;
    let attempts = 0;
    const maxAttempts = 5;
    
    do {
      // Generate random 8-character string
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      shareId = Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      
      // Check if file already exists
      const filePath = path.join(SHARES_DIR, `${shareId}.json`);
      try {
        await fs.access(filePath);
        // File exists, try again
        attempts++;
      } catch {
        // File doesn't exist, we can use this ID
        break;
      }
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique share ID' },
        { status: 500 }
      );
    }
    
    // Create the shared recommendation data
    const shareData = {
      shareId,
      title: title || null,
      prompt,
      recommendations,
      metadata: metadata || null,
      createdAt: new Date().toISOString(),
      viewCount: 0
    };
    
    // Write to file
    const filePath = path.join(SHARES_DIR, `${shareId}.json`);
    await fs.writeFile(filePath, JSON.stringify(shareData, null, 2), 'utf8');
    
    console.log(`✓ Created shared recommendation: ${shareId}`);
    
    // Cleanup old shares occasionally (10% chance)
    if (Math.random() < 0.1) {
      setTimeout(async () => {
        const deletedCount = await cleanupOldShares();
        if (deletedCount > 0) {
          console.log(`🧹 Cleaned up ${deletedCount} old share files`);
        }
      }, 100); // Run cleanup in background
    }
    
    // Return the share information
    return NextResponse.json({
      shareId: shareId,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/share/${shareId}`,
      createdAt: shareData.createdAt
    });
    
  } catch (error) {
    const clientId = getClientIdentifier(req);
    
    if (error instanceof z.ZodError) {
      logInvalidInput(clientId, '/api/share', `Zod validation failed: ${error.errors.map(e => e.message).join(', ')}`);
      
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    logError(clientId, '/api/share', error);
    console.error('Error in share API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
