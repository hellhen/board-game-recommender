'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

type SharedRecommendation = {
  shareId: string;
  title?: string;
  prompt: string;
  recommendations: Rec[];
  metadata?: any;
  viewCount: number;
  createdAt: string;
  expiresAt?: string;
};

export default function SharePage() {
  const params = useParams();
  const shareId = params?.shareId as string;
  
  const [sharedRec, setSharedRec] = useState<SharedRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    if (!shareId) return;

    async function fetchSharedRecommendation() {
      try {
        const response = await fetch(`/api/share/${shareId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load shared recommendation');
        }
        
        setSharedRec(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared recommendation');
      } finally {
        setLoading(false);
      }
    }

    fetchSharedRecommendation();
  }, [shareId]);

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const handleCreateOwn = () => {
    window.location.href = '/';
  };

  if (loading) {
    return (
      <main className="container">
        <div className="card card-highlight mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-wine-200 border-t-wine-600"></div>
              <span className="absolute inset-0 flex items-center justify-center text-lg">🍷</span>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-wine-800 dark:text-wine-200 mb-1">
                Loading shared recommendations...
              </h3>
              <p className="text-sm text-wine-600 dark:text-wine-300">
                Let me fetch those exquisite picks someone shared with you.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container">
        <div className="card bg-red-50 border-red-200 text-red-800 dark:bg-red-950/30 dark:border-red-800 dark:text-red-200 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">😤</span>
            <div>
              <h3 className="font-semibold mb-1">Oh, honey, no.</h3>
              <p className="text-sm opacity-90 mb-4">{error}</p>
              <button onClick={handleCreateOwn} className="button button-secondary">
                Get Your Own Recommendations
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!sharedRec) {
    return null;
  }

  const createdDate = new Date(sharedRec.createdAt).toLocaleDateString();
  const expiresDate = sharedRec.expiresAt ? new Date(sharedRec.expiresAt).toLocaleDateString() : null;

  return (
    <main className="container">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="heading-primary mb-4">
          🍷 Shared Board Game Recommendations
        </h1>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-xl font-semibold mb-2" style={{color: '#e8d5be'}}>
                {sharedRec.title || 'Curated Game Selections'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Original request: "{sharedRec.prompt}"
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                <span>📅 Shared on {createdDate}</span>
                <span>👀 {sharedRec.viewCount} views</span>
                {expiresDate && <span>⏰ Expires {expiresDate}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyUrl}
                className={clsx(
                  'button button-secondary text-sm px-4 py-2 flex items-center gap-2',
                  copySuccess && 'bg-green-500 text-white'
                )}
              >
                {copySuccess ? (
                  <>
                    <span>✓</span>
                    Copied!
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    Copy Link
                  </>
                )}
              </button>
              <button
                onClick={handleCreateOwn}
                className="button text-sm px-4 py-2 flex items-center gap-2"
              >
                <span>✨</span>
                Get My Own
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h2 className="heading-secondary mb-2">The Sommelier's Verdict</h2>
          <p style={{color: '#e8d5be'}}>
            Someone with excellent taste (clearly) wanted to share these picks with you.
          </p>
        </div>

        <div className="grid gap-6">
          {sharedRec.recommendations.map((rec, i) => (
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
                <h4 className="font-semibold mb-2" style={{color: '#e8d5be'}}>Why this is perfect:</h4>
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
            <h3 className="heading-secondary mb-3" style={{color: '#e8d5be'}}>Want your own personalized picks?</h3>
            <p className="mb-4" style={{color: '#e8d5be'}}>
              These are great, but imagine what the Sommelier could do with YOUR specific gaming situation. 
              It's going to be brutally honest and devastatingly accurate.
            </p>
            <button 
              onClick={handleCreateOwn}
              className="button"
            >
              🍷 Get My Personal Recommendations
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-16 text-center">
        <div className="card">
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
            <strong className="text-wine-600 dark:text-wine-400">Board Game Sassy Sommelier</strong> • 
            Sharing great taste, one recommendation at a time • 
            <span className="italic">Because good games deserve to be shared</span>
          </p>
        </div>
      </footer>
    </main>
  );
}
