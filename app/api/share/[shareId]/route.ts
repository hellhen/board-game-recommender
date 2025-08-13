import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Directory to store shared recommendations
const SHARES_DIR = path.join(process.cwd(), 'data', 'shares');

/**
 * GET /api/share/[shareId] - Retrieve a shared recommendation from file storage
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    const { shareId } = params;
    
    if (!shareId || typeof shareId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid share ID' },
        { status: 400 }
      );
    }
    
    // Read the shared recommendation file
    const filePath = path.join(SHARES_DIR, `${shareId}.json`);
    
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const shareData = JSON.parse(fileContent);
      
      // Increment view count
      shareData.viewCount = (shareData.viewCount || 0) + 1;
      
      // Save updated view count (fire and forget)
      setTimeout(async () => {
        try {
          await fs.writeFile(filePath, JSON.stringify(shareData, null, 2), 'utf8');
        } catch (error) {
          console.error('Failed to update view count:', error);
        }
      }, 0);
      
      // Return the shared recommendation
      return NextResponse.json({
        shareId: shareData.shareId,
        title: shareData.title,
        prompt: shareData.prompt,
        recommendations: shareData.recommendations,
        metadata: shareData.metadata,
        viewCount: shareData.viewCount,
        createdAt: shareData.createdAt,
        expiresAt: null // No expiration with this simple approach
      });
      
    } catch (fileError) {
      return NextResponse.json(
        { error: 'Shared recommendation not found' },
        { status: 404 }
      );
    }
    
  } catch (error) {
    console.error('Error retrieving shared recommendation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
