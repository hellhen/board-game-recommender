'use client';
import { useState } from 'react';

interface PriceStats {
  totalGamesWithPrices: number;
  averagePrice: number;
  pricesByStore: Record<string, { count: number; averagePrice: number }>;
  lastUpdated: Date;
}

interface Game {
  id: string;
  title: string;
}

export default function AdminPrices() {
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [gamesNeedingUpdate, setGamesNeedingUpdate] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [updateResults, setUpdateResults] = useState<string>('');
  const [selectedGames, setSelectedGames] = useState<string[]>([]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/prices?action=stats');
      const data = await response.json();
      setStats({
        ...data,
        lastUpdated: new Date(data.lastUpdated)
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGamesNeedingUpdate = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/prices?action=needs-update');
      const data = await response.json();
      setGamesNeedingUpdate(data.games || []);
    } catch (error) {
      console.error('Error loading games:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSelectedGames = async () => {
    if (selectedGames.length === 0) return;
    
    setLoading(true);
    setUpdateResults('Starting updates...');
    
    try {
      const gamesToUpdate = gamesNeedingUpdate
        .filter(game => selectedGames.includes(game.id))
        .map(game => ({ id: game.id, title: game.title }));

      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-bulk',
          gameIds: gamesToUpdate
        })
      });

      const result = await response.json();
      setUpdateResults(result.message || 'Update completed');
      
      // Refresh the data
      await loadGamesNeedingUpdate();
      await loadStats();
      
    } catch (error) {
      setUpdateResults(`Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const cleanupOldPrices = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' })
      });
      
      const result = await response.json();
      setUpdateResults(result.message || 'Cleanup completed');
      await loadStats();
      
    } catch (error) {
      setUpdateResults(`Cleanup error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleGameSelection = (gameId: string) => {
    setSelectedGames(prev => 
      prev.includes(gameId) 
        ? prev.filter(id => id !== gameId)
        : [...prev, gameId]
    );
  };

  const selectAllGames = () => {
    setSelectedGames(gamesNeedingUpdate.map(g => g.id));
  };

  const clearSelection = () => {
    setSelectedGames([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Price Management Admin</h1>
      
      {/* Stats Section */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Price Statistics</h2>
          <button 
            onClick={loadStats}
            disabled={loading}
            className="button button-secondary"
          >
            {loading ? 'Loading...' : 'Refresh Stats'}
          </button>
        </div>
        
        {stats ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {stats.totalGamesWithPrices}
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-200">
                Games with prices
              </div>
            </div>
            
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                ${stats.averagePrice.toFixed(2)}
              </div>
              <div className="text-sm text-green-800 dark:text-green-200">
                Average price
              </div>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {stats.lastUpdated.toLocaleDateString()}
              </div>
              <div className="text-sm text-purple-800 dark:text-purple-200">
                Last updated
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Click "Refresh Stats" to load price statistics</div>
        )}
        
        {stats && Object.keys(stats.pricesByStore).length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">Prices by Store</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(stats.pricesByStore).map(([store, data]) => (
                <div key={store} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded">
                  <span className="font-medium capitalize">{store.replace('-', ' ')}</span>
                  <span className="text-sm">
                    {data.count} games • Avg: ${data.averagePrice.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Games Needing Update Section */}
      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Games Needing Price Updates</h2>
          <button 
            onClick={loadGamesNeedingUpdate}
            disabled={loading}
            className="button button-secondary"
          >
            {loading ? 'Loading...' : 'Find Games'}
          </button>
        </div>
        
        {gamesNeedingUpdate.length > 0 ? (
          <div>
            <div className="flex gap-3 mb-4">
              <button 
                onClick={selectAllGames}
                className="button button-secondary text-sm"
              >
                Select All ({gamesNeedingUpdate.length})
              </button>
              <button 
                onClick={clearSelection}
                className="button button-secondary text-sm"
              >
                Clear Selection
              </button>
              <button 
                onClick={updateSelectedGames}
                disabled={loading || selectedGames.length === 0}
                className="button text-sm"
              >
                Update Selected ({selectedGames.length})
              </button>
            </div>
            
            <div className="max-h-96 overflow-y-auto border rounded">
              {gamesNeedingUpdate.slice(0, 50).map(game => (
                <label 
                  key={game.id} 
                  className="flex items-center p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input 
                    type="checkbox"
                    checked={selectedGames.includes(game.id)}
                    onChange={() => toggleGameSelection(game.id)}
                    className="mr-3"
                  />
                  <span className="font-medium">{game.title}</span>
                  <span className="text-xs text-gray-500 ml-2">({game.id})</span>
                </label>
              ))}
              {gamesNeedingUpdate.length > 50 && (
                <div className="p-3 text-center text-gray-500">
                  ... and {gamesNeedingUpdate.length - 50} more games
                </div>
              )}
            </div>
          </div>
        ) : gamesNeedingUpdate.length === 0 && !loading ? (
          <div className="text-gray-500">All games have recent price data!</div>
        ) : null}
      </div>

      {/* Actions Section */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex gap-3">
          <button 
            onClick={cleanupOldPrices}
            disabled={loading}
            className="button button-secondary"
          >
            Cleanup Old Prices
          </button>
        </div>
      </div>

      {/* Results Section */}
      {updateResults && (
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm whitespace-pre-wrap">
            {updateResults}
          </pre>
        </div>
      )}
    </div>
  );
}
