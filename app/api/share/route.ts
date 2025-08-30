import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

// Schema for creating a shared recommendation
const CreateShareSchema = z.object({
  prompt: z.string().min(1),
  recommendations: z.array(z.any()), // The recommendation objects
  metadata: z.any().optional(),
  title: z.string().optional(),
});

/**
 * POST /api/share - Create a shareable recommendation using Supabase storage
 */
export async function POST(req: NextRequest) {
  try {
    // Check if supabase client is available
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection not available' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const validatedData = CreateShareSchema.parse(body);
    const { prompt, recommendations, metadata, title } = validatedData;
    
    // Generate unique share ID
    let shareId: string;
    let attempts = 0;
    const maxAttempts = 5;
    
    do {
      // Generate random 8-character string
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      shareId = Array.from({ length: 8 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
      
      // Check if ID already exists in database
      const { data: existing } = await supabase
        .from('shared_recommendations')
        .select('share_id')
        .eq('share_id', shareId)
        .single();
      
      if (!existing) {
        // ID is unique, we can use it
        break;
      }
      
      attempts++;
    } while (attempts < maxAttempts);
    
    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique share ID' },
        { status: 500 }
      );
    }
    
    // Create the shared recommendation in database
    const { data: shareData, error: insertError } = await supabase
      .from('shared_recommendations')
      .insert({
        share_id: shareId,
        title: title || null,
        prompt,
        recommendations,
        metadata: metadata || null,
        created_at: new Date().toISOString(),
        view_count: 0
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('Database error creating share:', insertError);
      
      return NextResponse.json(
        { error: 'Failed to create share' },
        { status: 500 }
      );
    }
    
    console.log(`✓ Created shared recommendation: ${shareId}`);
    
    // Determine the base URL for the share link
    // Prefer explicit env var, then fall back to the request's origin
    const requestOrigin = (() => {
      try {
        const url = new URL(req.url);
        return `${url.protocol}//${url.host}`;
      } catch {
        const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
        const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
        return `${proto}://${host}`;
      }
    })();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || requestOrigin;
    
    // Return the share information
    return NextResponse.json({
      shareId: shareId,
      shareUrl: `${baseUrl}/share/${shareId}`,
      createdAt: shareData.created_at
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
