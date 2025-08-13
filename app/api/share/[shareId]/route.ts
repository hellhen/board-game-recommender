import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/share/[shareId] - Retrieve a shared recommendation from Supabase
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
    
    // Get the shared recommendation from database
    const { data: shareData, error: fetchError } = await supabase
      .from('shared_recommendations')
      .select('*')
      .eq('share_id', shareId)
      .single();
      
    if (fetchError || !shareData) {
      return NextResponse.json(
        { error: 'Shared recommendation not found' },
        { status: 404 }
      );
    }
    
    // Check if recommendation is expired (older than 30 days)
    const createdAt = new Date(shareData.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (createdAt < thirtyDaysAgo) {
      // Delete expired share
      await supabase
        .from('shared_recommendations')
        .delete()
        .eq('share_id', shareId);
        
      return NextResponse.json(
        { error: 'This shared recommendation has expired' },
        { status: 410 }
      );
    }
    
    // Increment view count
    const newViewCount = (shareData.view_count || 0) + 1;
    
    // Update view count (fire and forget)
    setTimeout(async () => {
      try {
        await supabase
          .from('shared_recommendations')
          .update({ view_count: newViewCount })
          .eq('share_id', shareId);
      } catch (error) {
        console.error('Failed to update view count:', error);
      }
    }, 0);
    
    // Return the shared recommendation
    return NextResponse.json({
      shareId: shareData.share_id,
      title: shareData.title,
      prompt: shareData.prompt,
      recommendations: shareData.recommendations,
      metadata: shareData.metadata,
      viewCount: newViewCount,
      createdAt: shareData.created_at,
      expiresAt: new Date(createdAt.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString() // 30 days from creation
    });
    
  } catch (error) {
    console.error('Error retrieving shared recommendation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
