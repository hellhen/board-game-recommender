const http = require('http');

async function testQuery(prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ prompt });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/recommend',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve({ error: 'Invalid JSON', raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  const testQueries = [
    "fun games for date night",
    "games with simultaneous turns", 
    "strategic games for experienced players"
  ];

  for (const query of testQueries) {
    console.log(`\n🎯 Testing: "${query}"`);
    console.log('=' .repeat(50));
    
    try {
      const result = await testQuery(query);
      console.log(`✅ Status: Success`);
      console.log(`📊 Recommendations: ${result.recommendations?.length || 0}`);
      console.log(`💡 Notes: ${result.metadata?.notes || 'No notes'}`);
      
      if (result.recommendations?.length > 0) {
        console.log('🎲 Games recommended:');
        result.recommendations.slice(0, 3).forEach((game, i) => {
          console.log(`   ${i+1}. ${game.title} (${game.specs.complexity} complexity)`);
        });
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Wait 2 seconds between requests to respect rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

runTests();
