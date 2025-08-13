/**
 * Test script to demonstrate the enhanced recommendation system improvements
 * Run this to see how the new system handles mechanic-specific requests
 */

import { intelligentGameSearch, getAllMechanics } from './lib/enhanced-database';
import { getAllGames } from './lib/database';

async function testEnhancedRecommendations() {
  console.log('🧪 Testing Enhanced Recommendation System');
  console.log('=========================================\n');

  try {
    // Test 1: Get all available mechanics
    console.log('📋 Available mechanics in database:');
    const mechanics = await getAllMechanics();
    console.log(`Found ${mechanics.length} unique mechanics:`);
    console.log(mechanics.slice(0, 10).join(', '), '...\n');

    // Test 2: Test specific mechanic search
    console.log('🎯 Test 1: Searching for "simultaneous" games');
    const simultaneousTest = await intelligentGameSearch('games with simultaneous turns', 20);
    console.log(`Found ${simultaneousTest.games.length} games`);
    console.log(`Match type: ${simultaneousTest.matchType}`);
    console.log(`Requested mechanics: ${simultaneousTest.requestedMechanics.join(', ')}`);
    if (simultaneousTest.games.length > 0) {
      console.log('Top matches:');
      simultaneousTest.games.slice(0, 3).forEach(game => {
        console.log(`  - ${game.title}: ${(game.mechanics || []).join(', ')}`);
      });
    }
    console.log('');

    // Test 3: Test worker placement
    console.log('🎯 Test 2: Searching for "worker placement" games');
    const workerTest = await intelligentGameSearch('worker placement games', 20);
    console.log(`Found ${workerTest.games.length} games`);
    console.log(`Match type: ${workerTest.matchType}`);
    console.log(`Requested mechanics: ${workerTest.requestedMechanics.join(', ')}`);
    if (workerTest.games.length > 0) {
      console.log('Top matches:');
      workerTest.games.slice(0, 3).forEach(game => {
        console.log(`  - ${game.title}: ${(game.mechanics || []).join(', ')}`);
      });
    }
    console.log('');

    // Test 4: Test deck building
    console.log('🎯 Test 3: Searching for "deck building" games');
    const deckTest = await intelligentGameSearch('deck building games for couples', 20);
    console.log(`Found ${deckTest.games.length} games`);
    console.log(`Match type: ${deckTest.matchType}`);
    console.log(`Requested mechanics: ${deckTest.requestedMechanics.join(', ')}`);
    if (deckTest.games.length > 0) {
      console.log('Top matches:');
      deckTest.games.slice(0, 3).forEach(game => {
        console.log(`  - ${game.title}: ${(game.mechanics || []).join(', ')}`);
      });
    }
    console.log('');

    // Test 5: Test non-existent mechanic
    console.log('🎯 Test 4: Searching for non-existent mechanic');
    const nonExistentTest = await intelligentGameSearch('games with time travel mechanics', 20);
    console.log(`Found ${nonExistentTest.games.length} games`);
    console.log(`Match type: ${nonExistentTest.matchType}`);
    console.log(`Requested mechanics: ${nonExistentTest.requestedMechanics.join(', ')}`);
    console.log('');

    // Test 6: Show database stats
    console.log('📊 Database Statistics:');
    const allGames = await getAllGames();
    console.log(`Total games: ${allGames.length}`);
    console.log(`Total mechanics: ${mechanics.length}`);
    
    // Count games per mechanic (top 10)
    const mechanicCounts = mechanics.map(mechanic => ({
      mechanic,
      count: allGames.filter(game => game.mechanics?.includes(mechanic)).length
    })).sort((a, b) => b.count - a.count);
    
    console.log('\nTop 10 most common mechanics:');
    mechanicCounts.slice(0, 10).forEach(({ mechanic, count }) => {
      console.log(`  ${mechanic}: ${count} games`);
    });

  } catch (error) {
    console.error('❌ Error during testing:', error);
  }
}

// Run if called directly
if (require.main === module) {
  testEnhancedRecommendations();
}

export { testEnhancedRecommendations };
