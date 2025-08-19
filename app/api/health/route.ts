import { NextResponse } from 'next/server';
import { supabase } from '../../../lib/supabase';

export async function GET() {
  try {
    // Check if supabase client is available
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }

    // Check database connection
    const { count, error } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      throw error;
    }

    // Check environment variables
    const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        gameCount: count || 0
      },
      environment: {
        supabase: hasSupabase,
        openai: hasOpenAI,
        model: process.env.MODEL || 'gpt-4o-mini'
      },
      deployment: {
        vercel: !!process.env.VERCEL,
        region: process.env.VERCEL_REGION || 'unknown'
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: {
        connected: false
      }
    }, { status: 500 });
  }
}
