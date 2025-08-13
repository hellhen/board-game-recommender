// Debug script to test recommendation logic directly
require('dotenv').config({ path: '.env.local' });
const { getAllGames } = require('./lib/database');

async function debugRecommendations() {
  console.log('🔍 Debugging recommendation system...');
  
  // Test database access
  console.log('\n1. Testing database access:');
  const allGames = await getAllGames();
  console.log(`Database has ${allGames.length} games`);
  
  if (allGames.length > 0) {
    console.log('Sample game:', {
      title: allGames[0].title,
      mechanics: allGames[0].mechanics,
      theme: allGames[0].theme
    });
  }
  
  // Check OpenAI key
  console.log('\n2. Checking OpenAI configuration:');
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('OpenAI API key configured:', apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : 'No');
  console.log('Model:', process.env.MODEL || 'gpt-4o-mini');
  
  // Test a direct API call to our endpoint (if we can)
  console.log('\n3. Making direct function call...');
  try {
    // Import the recommendation function directly
    const path = require('path');
    const routePath = path.join(__dirname, 'app', 'api', 'recommend', 'route.ts');
    console.log('Route file exists:', require('fs').existsSync(routePath));
    
    // Try to test the OpenAI call manually
    if (apiKey && apiKey !== 'your_openai_api_key_here') {
      const { OpenAI } = require('openai');
      const openai = new OpenAI({ apiKey });
      
      console.log('Testing OpenAI connection...');
      const testCompletion = await openai.chat.completions.create({
        model: process.env.MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a board game expert. Respond with valid JSON containing a "recommendations" array with at least one game recommendation.' },
          { role: 'user', content: 'Recommend 2 fun games for date night. Respond with JSON format: {"recommendations": [{"title": "Game Name", "reasoning": "Why it fits"}]}' }
        ],
        temperature: 0.8,
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });
      
      const responseText = testCompletion.choices[0]?.message?.content || '{}';
      console.log('OpenAI raw response:', responseText);
      
      try {
        const parsed = JSON.parse(responseText);
        console.log('Parsed successfully:', parsed);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', parseError);
      }
    } else {
      console.log('No valid OpenAI API key found');
    }
    
  } catch (error) {
    console.error('Error testing OpenAI:', error.message);
  }
}

debugRecommendations().catch(console.error);
