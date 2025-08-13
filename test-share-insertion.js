const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testShareInsertion() {
  console.log('Testing share insertion...');
  
  try {
    // Test basic table access
    console.log('\n1. Testing basic table access...');
    const { data: testData, error: testError } = await supabase
      .from('user_recommendations')
      .select('*')
      .limit(1);
    
    if (testError) {
      console.error('Basic access failed:', testError);
      return;
    }
    
    console.log('✓ Basic table access works');
    
    // Test session creation first
    console.log('\n2. Testing session creation...');
    const { data: sessionData, error: sessionError } = await supabase
      .from('user_sessions')
      .upsert({
        session_fingerprint: 'shared-recommendations',
        preferences: { type: 'shared' }
      }, {
        onConflict: 'session_fingerprint'
      })
      .select('id')
      .single();
    
    if (sessionError) {
      console.error('Session creation failed:', sessionError);
    } else {
      console.log('✓ Session creation works:', sessionData.id);
    }
    
    // Test insertion
    console.log('\n3. Testing insertion...');
    const shareId = 'test123';
    const { data, error } = await supabase
      .from('user_recommendations')
      .insert({
        session_id: sessionData?.id || null, // Use the session ID or null
        user_prompt: 'Test prompt',
        recommended_games: [], // Empty array for now since we need valid UUIDs
        llm_response: {
          recommendations: [{
            id: 'test-game-id', // This won't be in recommended_games since it's not a UUID
            title: 'Test Game',
            sommelierPitch: 'Great game',
            whyItFits: ['Perfect for testing'],
            specs: { players: '2', playtime: '30 min' }
          }],
          shareId: shareId,
          isShared: true,
          createdAt: new Date().toISOString()
        }
      })
      .select('id, created_at')
      .single();
    
    if (error) {
      console.error('Insertion failed:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('✓ Insertion successful:', data);
      
      // Test retrieval by shareId
      console.log('\n4. Testing retrieval by shareId...');
      const { data: retrievedData, error: retrievalError } = await supabase
        .from('user_recommendations')
        .select('*')
        .contains('llm_response', { shareId })
        .single();
      
      if (retrievalError) {
        console.error('Retrieval failed:', retrievalError);
      } else {
        console.log('✓ Retrieval successful:', retrievedData.llm_response.shareId);
      }
      
      // Clean up - delete the test record
      const { error: deleteError } = await supabase
        .from('user_recommendations')
        .delete()
        .eq('id', data.id);
      
      if (deleteError) {
        console.warn('Failed to clean up test record:', deleteError);
      } else {
        console.log('✓ Test record cleaned up');
      }
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testShareInsertion();
