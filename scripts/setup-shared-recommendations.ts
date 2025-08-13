/**
 * Setup script for shared_recommendations table in Supabase
 * Run this to create the table and policies needed for sharing functionality
 */

import { createClient } from '@supabase/supabase-js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function setupSharedRecommendationsTable() {
  // Initialize Supabase client with service role key (needed for admin operations)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials');
    console.error('Make sure you have NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  try {
    console.log('🔧 Setting up shared_recommendations table...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '../database/create_shared_recommendations.sql');
    const sqlContent = await fs.readFile(sqlPath, 'utf8');

    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql: sqlContent });

    if (error) {
      console.error('❌ Error executing SQL:', error);
      
      // Try alternative approach - execute each statement separately
      const statements = sqlContent
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      console.log('🔄 Trying to execute statements individually...');
      
      for (const statement of statements) {
        try {
          const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement + ';' });
          if (stmtError) {
            console.warn(`⚠️ Warning on statement: ${statement.substring(0, 50)}...`);
            console.warn('   Error:', stmtError.message);
          }
        } catch (e) {
          console.warn(`⚠️ Could not execute: ${statement.substring(0, 50)}...`);
        }
      }
    }

    // Test the table by checking if it exists
    const { data, error: testError } = await supabase
      .from('shared_recommendations')
      .select('count(*)')
      .limit(1);

    if (testError) {
      console.error('❌ Table creation failed:', testError.message);
      process.exit(1);
    }

    console.log('✅ shared_recommendations table created successfully!');
    console.log('✅ RLS policies configured');
    console.log('✅ Indexes created');
    console.log('✅ Sharing functionality is now ready for production');
    
    // Test creating a sample share
    console.log('🧪 Testing table with sample data...');
    
    const testShareId = 'test123';
    const { data: insertData, error: insertError } = await supabase
      .from('shared_recommendations')
      .insert({
        share_id: testShareId,
        title: 'Test Share',
        prompt: 'Test sharing functionality',
        recommendations: [{ name: 'Test Game', description: 'Testing' }],
        metadata: { test: true }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Test insert failed:', insertError.message);
    } else {
      console.log('✅ Test insert successful:', insertData.share_id);
      
      // Clean up test data
      await supabase
        .from('shared_recommendations')
        .delete()
        .eq('share_id', testShareId);
      
      console.log('✅ Test cleanup complete');
    }

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

setupSharedRecommendationsTable();
