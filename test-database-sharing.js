require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testAndCreateTable() {
  console.log('🧪 Testing if shared_recommendations table exists...');
  
  // Try to select from the table
  const { data, error } = await supabase
    .from('shared_recommendations')
    .select('id')
    .limit(1);

  if (error) {
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      console.log('📝 Table does not exist. Please create it manually.');
      console.log('\nSQL to run in Supabase SQL Editor:');
      console.log('='.repeat(60));
      console.log(`
-- Create shared_recommendations table
CREATE TABLE public.shared_recommendations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  share_id TEXT UNIQUE NOT NULL DEFAULT substr(gen_random_uuid()::text, 1, 8),
  prompt TEXT NOT NULL,
  recommendations JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  title TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_shared_recommendations_share_id ON public.shared_recommendations(share_id);
CREATE INDEX idx_shared_recommendations_created_at ON public.shared_recommendations(created_at);

-- Enable RLS
ALTER TABLE public.shared_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read" ON public.shared_recommendations FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.shared_recommendations FOR INSERT WITH CHECK (true);  
CREATE POLICY "Allow public update" ON public.shared_recommendations FOR UPDATE USING (true);
      `);
      console.log('='.repeat(60));
      console.log('\nAfter running the SQL, test again with: node test-database-sharing.js');
      return false;
    } else {
      console.error('❌ Unexpected error:', error);
      return false;
    }
  }

  console.log('✅ Table exists! Testing insert...');
  
  // Test insert
  const testShare = {
    prompt: 'Test prompt',
    recommendations: [{ name: 'Test Game', description: 'A test game' }],
    title: 'Test Share',
    metadata: { test: true }
  };

  const { data: insertData, error: insertError } = await supabase
    .from('shared_recommendations')
    .insert(testShare)
    .select()
    .single();

  if (insertError) {
    console.error('❌ Insert test failed:', insertError);
    return false;
  }

  console.log('✅ Insert test successful! Share ID:', insertData.share_id);

  // Test select by share_id
  const { data: selectData, error: selectError } = await supabase
    .from('shared_recommendations')
    .select('*')
    .eq('share_id', insertData.share_id)
    .single();

  if (selectError) {
    console.error('❌ Select test failed:', selectError);
    return false;
  }

  console.log('✅ Select test successful!');

  // Clean up test data
  await supabase
    .from('shared_recommendations')
    .delete()
    .eq('id', insertData.id);

  console.log('✅ Test data cleaned up');
  console.log('\n🎉 Database is ready for sharing functionality!');
  return true;
}

testAndCreateTable().catch(console.error);
