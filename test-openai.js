// Simple OpenAI test
require('dotenv').config({ path: '.env.local' });
const { OpenAI } = require('openai');

async function testOpenAI() {
  const openai = new OpenAI({ 
    apiKey: process.env.OPENAI_API_KEY 
  });
  
  console.log('Testing OpenAI with simple prompt...');
  
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: `You are a board game expert. You must respond with valid JSON containing a "recommendations" array.
          
          Example response format:
          {
            "recommendations": [
              {
                "title": "Azul",
                "reasoning": "Perfect tile-laying strategy game",
                "sommelierPitch": "Beautiful and engaging"
              }
            ]
          }`
        },
        { 
          role: 'user', 
          content: 'Recommend 3 simple board games for beginners. Respond only with valid JSON.'
        }
      ],
      temperature: 0.8,
      max_tokens: 500,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    console.log('Raw OpenAI response:');
    console.log(responseText);
    
    try {
      const parsed = JSON.parse(responseText);
      console.log('\nParsed successfully:');
      console.log(JSON.stringify(parsed, null, 2));
      console.log('\nNumber of recommendations:', parsed.recommendations?.length || 0);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
    }

  } catch (error) {
    console.error('OpenAI API error:', error);
  }
}

testOpenAI();
