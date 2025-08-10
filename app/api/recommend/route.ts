import { NextRequest, NextResponse } from 'next/server';
import data from '@/data/games.json';
import { z } from 'zod';
import { ResponseSchema, SommelierResponse } from '@/lib/schema';

function scoreGame(prompt: string, g: any) {
  const p = prompt.toLowerCase();
  let s = 0;
  const wantNature = /cascadia|nature|parks|meadow/.test(p);
  const wantFamily = /parents|family|kids|tonight|easy|quick|light/.test(p);
  const wantHeavy = /heavy|strategic|deep|hard|thinky|euro/.test(p);
  const wantParty = /party|silly|funny|laugh|social/.test(p);

  if (wantNature && (g.theme||'').toLowerCase().includes('nature')) s += 3;
  if (wantFamily && g.complexity <= 2.5) s += 2;
  if (wantHeavy && g.complexity >= 3.5) s += 2.5;
  if (wantParty && (g.tags||[]).includes('party')) s += 2;

  if (/cascadia/.test(p) && ['calico','meadow','parks','planet','trailblazers','floriferous'].includes(g.id)) s += 2.5;
  if (/showpiece/.test(p) && (g.tags||[]).includes('showpiece')) s += 2.5;
  if (/deep cut|deep-cut|indie|unknown/.test(p) && (g.tags||[]).includes('deep-cut')) s += 1.5;

  // basic time preference
  if (/under 60|short|quick/.test(p) && /\d+–\d+ min/.test(g.playtime||'')) {
    const [a,b] = (g.playtime||'0–0').split('–').map(x => parseInt(x.replace(/[^0-9]/g,'')));
    if (b && b <= 60) s += 1.5;
  }

  // small variety boost for not-too-similar themes
  return s;
}

function pitch(prompt: string, g: any): string {
  if ((g.theme||'').includes('nature')) return `A calm, nature-kissed puzzle that scratches the Cascadia itch without starting a brain fire.`;
  if ((g.tags||[]).includes('showpiece')) return `Table art meets gameplay — the kind of box that makes guests say “...whoa.”`;
  if (g.id === 'pipeline') return `An economic optimization beast that makes spreadsheets feel glamorous.`;
  if ((g.tags||[]).includes('party')) return `15–30 minutes of joyful chaos; teach in seconds, laugh for hours.`;
  return `Strategic, snappy, and surprisingly charming — built for your exact vibe tonight.`;
}

export async function POST(req: NextRequest) {
  const { prompt } = await req.json();
  const games = (data as any[]).slice();
  games.forEach(g => g._score = scoreGame(prompt||'', g));
  games.sort((a,b)=> b._score - a._score);

  const picks = games.slice(0,3).map(g => ({
    id: g.id,
    title: g.title,
    sommelierPitch: pitch(prompt||'', g),
    whyItFits: [
      (g.theme ? `Theme: ${g.theme}` : 'Fits your stated vibe'),
      `Mechanics: ${(g.mechanics||[]).slice(0,2).join(', ')}`,
      `Playtime/Teach: ${g.playtime || 'varies'}`
    ],
    specs: { players: g.players || null, playtime: g.playtime || null, complexity: g.complexity ?? null },
    mechanics: g.mechanics || [],
    theme: g.theme || '',
    price: { amount: None as any, store: null, url: null },
    alternates: games.slice(3,8).map(x=>x.id).slice(0,3)
  }));

  const response: SommelierResponse = {
    followUps: [],
    recommendations: picks,
    metadata: {
      interpretedNeeds: [],
      notes: "Local heuristic selection. Wire to an LLM and tools for production."
    }
  };

  // Validate
  const parsed = ResponseSchema.safeParse(response);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  return NextResponse.json(parsed.data);
}
