require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createSharedRecommendationsTable() {
  console.log('🔧 Creating shared_recommendations table...');
  
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Create shared_recommendations table
      CREATE TABLE IF NOT EXISTS public.shared_recommendations (
        id TEXT PRIMARY KEY DEFAULT generate_random_uuid()::text,
        share_id TEXT UNIQUE NOT NULL DEFAULT substring(generate_random_uuid()::text, 1, 8),
        prompt TEXT NOT NULL,
        recommendations JSONB NOT NULL,
        metadata JSONB DEFAULT '{}',
        title TEXT,
        view_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );

      -- Create index on share_id for fast lookups
      CREATE INDEX IF NOT EXISTS idx_shared_recommendations_share_id 
      ON public.shared_recommendations(share_id);

      -- Create index on created_at for cleanup queries
      CREATE INDEX IF NOT EXISTS idx_shared_recommendations_created_at 
      ON public.shared_recommendations(created_at);

      -- Enable RLS
      ALTER TABLE public.shared_recommendations ENABLE ROW LEVEL SECURITY;

      -- Create policies
      DROP POLICY IF EXISTS "Allow public read access" ON public.shared_recommendations;
      DROP POLICY IF EXISTS "Allow public insert" ON public.shared_recommendations;
      DROP POLICY IF EXISTS "Allow public update for view count" ON public.shared_recommendations;

      CREATE POLICY "Allow public read access" ON public.shared_recommendations
        FOR SELECT USING (true);

      CREATE POLICY "Allow public insert" ON public.shared_recommendations  
        FOR INSERT WITH CHECK (true);

      CREATE POLICY "Allow public update for view count" ON public.shared_recommendations
        FOR UPDATE USING (true) WITH CHECK (true);
    `
  });

  if (error) {
    // If exec_sql doesn't work, try individual queries
    console.log('🔄 Trying alternative approach...');
    
    // Create table
    const { error: tableError } = await supabase
      .from('shared_recommendations')
      .select('id')
      .limit(1);
      
    if (tableError && tableError.code === 'PGRST116') {
      console.log('📝 Table does not exist, creating manually via SQL...');
      console.log('Please run this SQL in your Supabase SQL editor:');
      console.log('\n' + '='.repeat(50));
      console.log(`
-- Create shared_recommendations table
CREATE TABLE IF NOT EXISTS public.shared_recommendations (
  id TEXT PRIMARY KEY DEFAULT generate_random_uuid()::text,
  share_id TEXT UNIQUE NOT NULL DEFAULT substring(generate_random_uuid()::text, 1, 8),
  prompt TEXT NOT NULL,
  recommendations JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  title TEXT,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_shared_recommendations_share_id 
ON public.shared_recommendations(share_id);

CREATE INDEX IF NOT EXISTS idx_shared_recommendations_created_at 
ON public.shared_recommendations(created_at);

-- Enable RLS
ALTER TABLE public.shared_recommendations ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow public read access" ON public.shared_recommendations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON public.shared_recommendations  
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update for view count" ON public.shared_recommendations
  FOR UPDATE USING (true) WITH CHECK (true);
      `);
      console.log('='.repeat(50));
      return false;
    }
    
    console.error('❌ Error setting up table:', error);
    return false;
  }

  console.log('✅ shared_recommendations table created successfully!');
  return true;
}

async function testConnection() {
  console.log('🧪 Testing Supabase connection...');
  
  const { data, error } = await supabase
    .from('shared_recommendations')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Connection test failed:', error.message);
    return false;
  }

  console.log('✅ Supabase connection successful!');
  return true;
}

async function main() {
  console.log('🚀 Setting up database for shared recommendations...\n');
  
  const created = await createSharedRecommendationsTable();
  if (!created) {
    console.log('\n❌ Setup incomplete. Please run the SQL manually.');
    return;
  }
  
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ Connection test failed after setup.');
    return;
  }
  
  console.log('\n🎉 Database setup complete!');
  console.log('✅ shared_recommendations table is ready');
  console.log('✅ RLS policies configured');  
  console.log('✅ Indexes created');
  console.log('\nYou can now test the sharing functionality!');
}

main().catch(console.error);
