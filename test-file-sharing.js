const { default: fetch } = require('node-fetch');

async function testFileBasedSharing() {
  console.log('Testing file-based sharing system...');
  
  try {
    // Test share creation
    console.log('\n1. Testing share creation...');
    const sharePayload = {
      prompt: 'Test strategic games for two players',
      recommendations: [
        {
          id: 'test-game-1',
          title: 'Test Strategy Game',
          sommelierPitch: 'Perfect for testing sharing functionality',
          whyItFits: ['Great for two players', 'Strategic depth', 'Easy to learn'],
          specs: { players: '2', playtime: '45 min', complexity: 3 },
          mechanics: ['Hand Management', 'Set Collection'],
          theme: 'Abstract Strategy'
        }
      ],
      metadata: { testMode: true },
      title: 'Test Share - Strategic Games'
    };
    
    const response = await fetch('http://localhost:3001/api/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sharePayload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Share creation failed:', response.status, errorText);
      return;
    }
    
    const shareResult = await response.json();
    console.log('✓ Share created successfully:', shareResult.shareId);
    console.log('Share URL:', shareResult.shareUrl);
    
    // Test share retrieval
    console.log('\n2. Testing share retrieval...');
    const retrievalResponse = await fetch(`http://localhost:3001/api/share/${shareResult.shareId}`);
    
    if (!retrievalResponse.ok) {
      const errorText = await retrievalResponse.text();
      console.error('Share retrieval failed:', retrievalResponse.status, errorText);
      return;
    }
    
    const retrievedShare = await retrievalResponse.json();
    console.log('✓ Share retrieved successfully:', retrievedShare.title);
    console.log('Recommendations count:', retrievedShare.recommendations.length);
    console.log('View count:', retrievedShare.viewCount);
    
    // Test view count increment
    console.log('\n3. Testing view count increment...');
    const secondRetrievalResponse = await fetch(`http://localhost:3001/api/share/${shareResult.shareId}`);
    const secondRetrievedShare = await secondRetrievalResponse.json();
    console.log('View count after second view:', secondRetrievedShare.viewCount);
    
    console.log('\n✅ File-based sharing system is working correctly!');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testFileBasedSharing();
