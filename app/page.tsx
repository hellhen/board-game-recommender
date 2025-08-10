'use client';
import { useState } from 'react';
import clsx from 'clsx';

type Rec = {
  id: string | null;
  title: string;
  sommelierPitch: string;
  whyItFits: string[];
  specs: { players: string | null; playtime: string | null; complexity?: number | null };
  mechanics?: string[];
  theme?: string;
  price?: { amount?: number | null; store?: string | null; url?: string | null };
  alternates?: string[];
};

export default function Home() {
  const [prompt, setPrompt] = useState('We liked Cascadia and are playing with my parents tonight.');
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/recommend', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));
      setRecs(json.recommendations);
    } catch (err:any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1 className="text-3xl font-bold mb-2">🎲 Board Game Sommelier</h1>
      <p className="text-neutral-600 mb-6">Tell me who you’re playing with and the vibe. I’ll pour you three perfect picks.</p>

      <form onSubmit={onSubmit} className="card mb-6">
        <textarea
          className="input h-24"
          value={prompt}
          onChange={e=>setPrompt(e.target.value)}
          placeholder="Example: 4 players, under 60 minutes, love nature themes like Cascadia."
        />
        <div className="mt-3 flex gap-2">
          <button className={clsx('button', loading && 'opacity-60')} disabled={loading}>
            {loading ? 'Decanting…' : 'Recommend 3 Games'}
          </button>
          <span className="chip" onClick={()=>setPrompt(prev=>prev + ' Prefer short teach.')}>Short teach</span>
          <span className="chip" onClick={()=>setPrompt(prev=>prev + ' Deep strategic.')}>More strategic</span>
          <span className="chip" onClick={()=>setPrompt(prev=>prev + ' Party vibe.')}>Party vibe</span>
        </div>
      </form>

      {error && <div className="card border-red-300 text-red-700">{error}</div>}

      {recs && (
        <div className="grid gap-4">
          {recs.map((r, i) => (
            <div key={i} className="card">
              <div className="flex items-start justify-between">
                <h2 className="text-xl font-semibold">{r.title}</h2>
                {r.specs?.complexity!=null && <span className="text-sm opacity-70">Complexity: {r.specs.complexity}</span>}
              </div>
              <p className="mt-1 italic">{r.sommelierPitch}</p>
              <ul className="mt-3 list-disc ml-6">
                {r.whyItFits?.map((w,idx)=>(<li key={idx}>{w}</li>))}
              </ul>
              <div className="mt-3 text-sm opacity-80">
                {r.specs?.players && <span className="mr-3">👥 {r.specs.players}</span>}
                {r.specs?.playtime && <span>⏱ {r.specs.playtime}</span>}
              </div>
              {r.alternates && r.alternates.length>0 && (
                <div className="mt-3 text-sm">
                  <span className="opacity-70 mr-2">Alternates:</span>
                  {r.alternates.slice(0,3).map((a,idx)=>(<span key={idx} className="chip mr-2">{a}</span>))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <footer className="mt-10 text-xs opacity-70">Starter kit. Wire to your favorite LLM + tools for production.</footer>
    </main>
  )
}
