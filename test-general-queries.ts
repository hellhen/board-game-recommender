/**
 * Simple test for general queries (non-mechanic based)
 * Run this after your database is set up to verify general queries work
 */

import { intelligentGameSearch } from './lib/enhanced-database';

const generalQueries = [
  "fun games for date night",
  "something strategic for 4 players", 
  "family games",
  "party games",
  "quick games",
  "relaxing games",
  "games for couples",
  "brain burning strategy games",
  "something light and fun"
];

async function testGeneralQueries() {
  console.log('🧪 Testing General Query Handling');
  console.log('================================\n');
  
  for (const query of generalQueries) {
    try {
      console.log(`🎯 Testing: "${query}"`);
      const result = await intelligentGameSearch(query, 20);
      
      console.log(`   Found: ${result.games.length} games`);
      console.log(`   Match type: ${result.matchType}`);
      console.log(`   Mechanics detected: ${result.requestedMechanics.join(', ') || 'none'}`);
      
      if (result.games.length > 0) {
        console.log('   Top games:');
        result.games.slice(0, 3).forEach(game => {
          console.log(`     - ${game.title} (${game.complexity}, ${game.theme})`);
        });
      } else {
        console.log('   ❌ NO GAMES FOUND - This is the problem!');
      }
      console.log('');
      
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error);
      console.log('');
    }
  }
}

// For CLI usage
if (require.main === module) {
  testGeneralQueries().catch(console.error);
}

export { testGeneralQueries };
