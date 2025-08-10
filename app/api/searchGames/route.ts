import { NextRequest, NextResponse } from 'next/server';
import data from '@/data/games.json';

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  const q = (query || '').toLowerCase();
  const results = (data as any[]).filter(g =>
    g.title.toLowerCase().includes(q) ||
    (g.tags||[]).some((t:string)=> t.includes(q)) ||
    (g.theme||'').toLowerCase().includes(q)
  ).slice(0, 10).map(g => ({ id: g.id, title: g.title }));
  return NextResponse.json({ results });
}
