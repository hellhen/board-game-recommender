/**
 * Simple script to create the shared_recommendations table in Supabase
 * This uses a direct SQL approach since the RPC method might not be available
 */

import { createClient } from '@supabase/supabase-js';

async function createSharedRecommendationsTable() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment');
    return false;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔧 Creating shared_recommendations table...');

    // Test if we can access the table (it might already exist)
    const { data: existingTable, error: checkError } = await supabase
      .from('shared_recommendations')
      .select('count')
      .limit(1);

    if (!checkError) {
      console.log('✅ shared_recommendations table already exists!');
      return true;
    }

    console.log('📋 Table does not exist, creating it...');
    console.log('');
    console.log('Please run this SQL in your Supabase SQL Editor:');
    console.log('='.repeat(50));
    console.log(`
-- Create shared_recommendations table
CREATE TABLE shared_recommendations (
    id SERIAL PRIMARY KEY,
    share_id VARCHAR(8) NOT NULL UNIQUE,
    title TEXT,
    prompt TEXT NOT NULL,
    recommendations JSONB NOT NULL,
    metadata JSONB,
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_shared_recommendations_share_id ON shared_recommendations(share_id);
CREATE INDEX idx_shared_recommendations_created_at ON shared_recommendations(created_at);

-- Enable RLS
ALTER TABLE shared_recommendations ENABLE ROW LEVEL SECURITY;

-- Policies for sharing functionality
CREATE POLICY "Public read access" ON shared_recommendations FOR SELECT USING (true);
CREATE POLICY "Public insert access" ON shared_recommendations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update access" ON shared_recommendations FOR UPDATE USING (true);
CREATE POLICY "Cleanup old shares" ON shared_recommendations FOR DELETE USING (created_at < NOW() - INTERVAL '30 days');
`);
    console.log('='.repeat(50));
    console.log('');
    console.log('After running the SQL, the sharing functionality will work in production!');
    
    return false; // Table needs to be created manually
    
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  createSharedRecommendationsTable();
}
