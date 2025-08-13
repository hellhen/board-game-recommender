import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { z } from 'zod';

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
    const body = await req.json();
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
    
    // Return the share information
    return NextResponse.json({
      shareId: shareId,
      shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/share/${shareId}`,
      createdAt: shareData.createdAt
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error in share API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
