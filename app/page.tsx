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
  const defaultSuggestion = 'We want something strategic but not brain-melting for date night.';
  const [prompt, setPrompt] = useState(defaultSuggestion);
  const [isPrefill, setIsPrefill] = useState(true);
  const [loading, setLoading] = useState(false);
  const [recs, setRecs] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [originalPrompt, setOriginalPrompt] = useState<string>('');
  const loadingMessages: { title: string; body: string }[] = [
    {
      title: "Patience, darling. I'm being thorough.",
      body:
        "I'm sifting through my vast knowledge to find games that won't disappoint your obviously discerning taste. This takes 10-15 seconds because quality can't be rushed, unlike your last gaming purchase.",
    },
    {
      title: 'Hold your horses—and your dice.',
      body:
        "I'm curating impeccable picks that won't embarrass you. Excellence takes 10–15 seconds; desperation takes less.",
    },
    {
      title: 'Sip slowly. Great taste takes time.',
      body:
        "I'm swirling through thousands of options to find games worthy of your table. Unlike impulse buys, this will age well.",
    },
    {
      title: 'Shh. The sommelier is selecting.',
      body:
        "I'm eliminating the mediocre so you don't have to pretend to enjoy it. Give me a moment to be brilliant.",
    },
    {
      title: 'Almost there, superstar.',
      body:
        "I'm balancing theme, tension, and table drama so you look good and have fun. Quality over chaos—always.",
    },
  ];
  const [currentLoadingIndex, setCurrentLoadingIndex] = useState<number>(0);
  const [lastLoadingIndex, setLastLoadingIndex] = useState<number | null>(null);
  const [loadingQueue, setLoadingQueue] = useState<number[]>([]);

  function shuffledQueueAvoidingLast(total: number, avoid: number | null): number[] {
    const arr = Array.from({ length: total }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (avoid !== null && arr.length > 1 && arr[0] === avoid) {
      // Swap first two to avoid immediate repeat
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  }

  const sassyPrompts = [
    "I need something that makes me look smarter than I am",
    "Help me destroy my friends (but like, nicely)",
    "Date night but I'm secretly competitive AF",
    "My family argues during games—fix this",
    "Something strategic that won't melt my brain"
  ];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Pick the next message from a shuffled, non-repeating queue
    setLoadingQueue(prev => {
      let queue = prev;
      if (!queue || queue.length === 0) {
        queue = shuffledQueueAvoidingLast(loadingMessages.length, lastLoadingIndex);
      }
      const nextIdx = queue[0] ?? 0;
      setCurrentLoadingIndex(nextIdx);
      setLastLoadingIndex(nextIdx);
      return queue.slice(1);
    });
    setLoading(true); 
    setError(null);
    setRecs(null);
    setShareUrl(null);
    
    try {
      const res = await fetch('/api/recommend', { 
        method: 'POST', 
        headers: {'Content-Type':'application/json'}, 
        body: JSON.stringify({ prompt }) 
      });
      
      const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  setRecs(json.recommendations);
  setOriginalPrompt(prompt); // Store the prompt used for this recommendation
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleShare() {
    if (!recs || !originalPrompt) return;
    
    setShareLoading(true);
    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: originalPrompt,
          recommendations: recs,
          title: `Board game recommendations for "${originalPrompt.slice(0, 50)}..."`
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      setShareUrl(data.shareUrl);
      
      // Copy to clipboard automatically
      try {
        await navigator.clipboard.writeText(data.shareUrl);
      } catch (clipboardError) {
        console.log('Could not copy to clipboard automatically');
      }
      
    } catch (error: any) {
      setError(error.message || 'Failed to create shareable link');
    } finally {
      setShareLoading(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  }

  return (
    <main className="container">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="heading-primary mb-4">
          🍷 Board Game Sassy Sommelier
        </h1>
  <p className="text-xl text-slate-500 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Look, I've got <span className="text-sassy font-semibold">exquisite taste</span> in board games, 
          and frankly, you probably don't. But that's fine—I'm here to fix that. 
          Tell me what you <em>think</em> you want, and I'll tell you what you{' '}
          <em className="font-medium text-wine-600">actually</em> need.
        </p>
  <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-sm text-slate-400 dark:text-slate-300">
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
          <label className="block text-sm font-medium text-slate-400 dark:text-slate-200 mb-2">
            What's your gaming situation? Don't hold back.
          </label>
          <textarea
            className="input h-32 resize-none"
            value={prompt}
            onChange={e => {
              const val = e.target.value;
              setPrompt(val);
              setIsPrefill(val === defaultSuggestion);
            }}
            onFocus={() => setIsPrefill(prompt === defaultSuggestion)}
            style={isPrefill ? { fontStyle: 'italic', color: '#94a3b8' } : undefined}
            placeholder="Be brutally specific. 'Something fun' is useless. Try 'I want to prove I'm smarter than my cocky brother-in-law without him rage-quitting...'"
          />
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-xs text-slate-400 dark:text-slate-300 font-medium mb-1 w-full">
            QUICK EXAMPLES (click to add):
          </span>
      {sassyPrompts.map((sassyPrompt, idx) => (
            <span 
              key={idx}
              className="chip text-xs"
        onClick={() => { setPrompt(sassyPrompt); setIsPrefill(false); }}
            >
              {sassyPrompt}
            </span>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button 
            className={clsx('button w-full sm:flex-1 sm:w-auto', loading && 'opacity-60')} 
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
              className="button button-secondary w-full sm:w-auto"
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
                {loadingMessages[currentLoadingIndex]?.title || "Patience, darling. I'm being thorough."}
              </h3>
              <p className="text-sm text-wine-600 dark:text-wine-300">
                {loadingMessages[currentLoadingIndex]?.body ||
                  "I'm sifting through my vast knowledge to find games that won't disappoint your obviously discerning taste. This takes 10-15 seconds because quality can't be rushed, unlike your last gaming purchase."}
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

      <div className="grid grid-cols-1 gap-6">
            {recs.map((rec, i) => (
        <div key={i} className="card group sm:hover:scale-[1.02] transition-all duration-300">
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
          <p className="font-medium italic leading-relaxed break-words" style={{color: '#e8d5be'}}>
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
          <li key={idx} className="flex items-start gap-2 text-sm break-words" style={{color: '#e8d5be'}}>
                        <span className="text-wine-400 font-bold mt-0.5">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Game specs */}
                <div className="flex flex-wrap gap-4 p-4 bg-wine-800/10 border border-wine-600/20 rounded-2xl mb-4">
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

                {/* Purchase Links */}
                {rec.price?.amount && rec.price?.url && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-green-800/20 to-emerald-800/20 border border-green-600/30 rounded-2xl">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl">💰</span>
                        <div>
                          <div className="font-semibold text-green-200 text-lg">
                            ${rec.price.amount.toFixed(2)}
                          </div>
                          <div className="text-xs text-green-300 capitalize">
                            at {rec.price.store?.replace('-', ' ')}
                          </div>
                        </div>
                      </div>
                      <a 
                        href={rec.price.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="button bg-green-600 hover:bg-green-500 text-white border-green-500 flex items-center gap-2 text-sm w-full sm:w-auto justify-center"
                      >
                        <span>🛒</span>
                        Buy Now
                      </a>
                    </div>
                    <div className="mt-2 text-xs text-green-400">
                      Price updated recently • Click to purchase
                    </div>
                  </div>
                )}

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
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  onClick={() => { setRecs(null); setPrompt(''); setShareUrl(null); }}
                  className="button w-full sm:w-auto"
                >
                  🍷 Get More Recommendations
                </button>
                <button
                  onClick={handleShare}
                  disabled={shareLoading}
                  className={clsx(
                    'button button-secondary flex items-center gap-2 w-full sm:w-auto justify-center',
                    shareLoading && 'opacity-60'
                  )}
                >
                  {shareLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-wine-400/30 border-t-wine-400"></div>
                      Creating link...
                    </>
                  ) : (
                    <>
                      <span>📤</span>
                      Share These Picks
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Share URL Display */}
          {shareUrl && (
            <div className="text-center mt-6">
              <div className="card bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">✨</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                      Perfect! Your recommendations are now shareable
                    </h4>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                      Anyone with this link can see your curated picks (and my devastatingly accurate commentary).
                    </p>
                    <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 rounded-lg border">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 bg-transparent text-sm font-mono text-slate-600 dark:text-slate-300 outline-none"
                      />
                      <button
                        onClick={copyShareUrl}
                        className="button-secondary text-xs px-3 py-1"
                        title="Copy to clipboard"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
