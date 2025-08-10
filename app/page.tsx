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
  const [prompt, setPrompt] = useState('We want something strategic but not brain-melting for date night.');
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sassyPrompts = [
    "I need something that makes me look smarter than I am",
    "Help me destroy my friends (but like, nicely)",
    "Date night but I'm secretly competitive AF",
    "My family argues during games—fix this",
    "Something strategic that won't melt my brain"
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); 
    setError(null);
    setRecs(null);
    
    try {
      const res = await fetch('/api/recommend', { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ prompt }) 
      });
      
      const json = await res.json();
      if (!res.ok) throw new Error(JSON.stringify(json));
      setRecs(json.recommendations);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="heading-primary mb-4">
          � Board Game Sassy Sommelier
        </h1>
        <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Look, I've got <span className="text-sassy font-semibold">exquisite taste</span> in board games, 
          and frankly, you probably don't. But that's fine—I'm here to fix that. 
          Tell me what you <em>think</em> you want, and I'll tell you what you{' '}
          <em className="font-medium text-wine-600">actually</em> need.
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 text-sm text-slate-500">
          <span>🔥 Brutally honest</span>
          <span>•</span>
          <span>🎯 Zero sugar-coating</span>
          <span>•</span>
          <span>✨ Devastatingly accurate</span>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={onSubmit} className="card mb-8">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            What's your gaming situation? Don't hold back.
          </label>
          <textarea
            className="input h-32 resize-none"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Be brutally specific. 'Something fun' is useless. Try 'I want to prove I'm smarter than my cocky brother-in-law without him rage-quitting...'"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1 w-full">
            QUICK VIBES (click to add):
          </span>
          {sassyPrompts.map((sassyPrompt, idx) => (
            <span 
              key={idx}
              className="chip text-xs"
              onClick={() => setPrompt(sassyPrompt)}
            >
              {sassyPrompt}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            className={clsx('button flex-1', loading && 'opacity-60')} 
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                Sommelier is judging...
              </>
            ) : (
              <>
                🍷 Give Me My Picks
              </>
            )}
          </button>
          
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              className="button button-secondary"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {/* Error State */}
      {error && (
        <div className="card bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">😤</span>
            <div>
              <h3 className="font-semibold mb-1">Oh, honey, no.</h3>
              <p className="text-sm opacity-90">Something went wrong, and it's probably not my fault. Try again, sweetheart.</p>
              <details className="mt-2 text-xs opacity-70">
                <summary className="cursor-pointer">Technical details (if you're into that sort of thing)</summary>
                <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
              </details>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="card card-highlight mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-wine-200 border-t-wine-600"></div>
              <span className="absolute inset-0 flex items-center justify-center text-lg">🍷</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-wine-800 dark:text-wine-200 mb-1">
                Patience, darling. I'm being thorough.
              </h3>
              <p className="text-sm text-wine-600 dark:text-wine-300">
                I'm sifting through my vast knowledge to find games that won't disappoint your obviously discerning taste. 
                This takes 10-15 seconds because <em>quality</em> can't be rushed, unlike your last gaming purchase.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recs && recs.length > 0 && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="heading-secondary mb-2">My Verdict</h2>
            <p style={{color: '#e8d5be'}}>
              Three games that will actually improve your tragic game collection. Try not to mess this up.
            </p>
          </div>

          <div className="grid gap-6">
            {recs.map((rec, i) => (
              <div key={i} className="card group hover:scale-[1.02] transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-wine-500 to-wine-600 text-white font-bold text-sm">
                        {i + 1}
                      </span>
                      <h3 className="text-2xl font-bold group-hover:text-gold-300 transition-colors" style={{color: '#e8d5be'}}>
                        {rec.title}
                      </h3>
                    </div>
                    
                    {rec.specs?.complexity && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs font-medium" style={{color: '#e8d5be'}}>Complexity:</span>
                        <div className="flex items-center">
                          {[1,2,3,4,5].map((level) => (
                            <div
                              key={level}
                              className={clsx(
                                "w-3 h-3 rounded-full mr-1",
                                level <= (rec.specs?.complexity || 0) 
                                  ? "bg-gradient-to-r from-wine-500 to-wine-600 shadow-sm" 
                                  : "bg-wine-600/40 border border-wine-500/60"
                              )}
                            />
                          ))}
                          <span className="ml-2 text-sm font-medium" style={{color: '#e8d5be'}}>
                            {rec.specs.complexity}/5
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sommelier Pitch */}
                <div className="mb-4 p-4 rounded-2xl bg-wine-800/20 border border-wine-600/30">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl animate-float">🍷</span>
                    <div>
                      <p className="font-medium italic leading-relaxed" style={{color: '#e8d5be'}}>
                        "{rec.sommelierPitch}"
                      </p>
                      <span className="text-xs font-medium" style={{color: '#c4a882'}}>
                        — Your Sassy Sommelier
                      </span>
                    </div>
                  </div>
                </div>

                {/* Why it fits */}
                <div className="mb-4">
                  <h4 className="font-semibold mb-2" style={{color: '#e8d5be'}}>Why this is perfect for you:</h4>
                  <ul className="space-y-1">
                    {rec.whyItFits?.map((reason, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm" style={{color: '#e8d5be'}}>
                        <span className="text-wine-400 font-bold mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Game specs */}
                <div className="flex flex-wrap gap-4 p-4 bg-wine-800/10 border border-wine-600/20 rounded-2xl">
                  {rec.specs?.players && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">👥</span>
                      <span className="text-sm font-medium" style={{color: '#e8d5be'}}>
                        {rec.specs.players}
                      </span>
                    </div>
                  )}
                  {rec.specs?.playtime && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⏱</span>
                      <span className="text-sm font-medium" style={{color: '#e8d5be'}}>
                        {rec.specs.playtime}
                      </span>
                    </div>
                  )}
                  {rec.theme && (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎨</span>
                      <span className="text-sm font-medium capitalize" style={{color: '#e8d5be'}}>
                        {rec.theme}
                      </span>
                    </div>
                  )}
                </div>

                {/* Alternates */}
                {rec.alternates && rec.alternates.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-wine-600/30">
                    <p className="text-xs font-medium mb-2" style={{color: '#c4a882'}}>
                      If you're feeling adventurous, also consider:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {rec.alternates.slice(0, 3).map((alt, idx) => (
                        <span key={idx} className="chip text-xs">
                          {alt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Call to action */}
          <div className="text-center mt-12">
            <div className="card">
              <h3 className="heading-secondary mb-3" style={{color: '#e8d5be'}}>Satisfied with my impeccable taste?</h3>
              <p className="mb-4" style={{color: '#e8d5be'}}>
                Of course you are. Now stop browsing and go play something. 
                Your games are waiting, and so is the fun you've been putting off.
              </p>
              <button 
                onClick={() => { setRecs(null); setPrompt(''); }}
                className="button"
              >
                🍷 Get More Recommendations
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Footer */}
      <footer className="mt-16 text-center">
        <div className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            <strong className="text-wine-600 dark:text-wine-400">Board Game Sassy Sommelier</strong> • 
            Powered by questionable AI and unquestionable attitude • 
            <span className="italic">Your taste in games just got an upgrade</span>
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            Made with 🍷 and a healthy dose of gaming snobbery
          </p>
        </div>
      </footer>
    </main>
  )
}
