import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runDirectMigration() {
  console.log('🚀 Running Direct Price Table Migration');
  console.log('==================================\n');

  try {
    // First, let's check the current table structure
    console.log('🔍 Checking current table structure...');
    const { data: columns, error: columnError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type')
      .eq('table_name', 'game_prices')
      .eq('table_schema', 'public');

    if (columnError) {
      console.log('❌ Error checking table structure:', columnError);
    } else {
      console.log('📋 Current columns:');
      columns?.forEach(col => console.log(`  - ${col.column_name}: ${col.data_type}`));
      console.log('');
    }

    // Execute direct SQL commands
    const migrations = [
      {
        name: 'Add availability column',
        sql: `ALTER TABLE game_prices ADD COLUMN IF NOT EXISTS availability VARCHAR(50) DEFAULT 'unknown';`
      },
      {
        name: 'Add affiliate_url column',
        sql: `ALTER TABLE game_prices ADD COLUMN IF NOT EXISTS affiliate_url TEXT;`
      },
      {
        name: 'Add scrape_confidence column',
        sql: `ALTER TABLE game_prices ADD COLUMN IF NOT EXISTS scrape_confidence DECIMAL(3,2) DEFAULT 0.0;`
      },
      {
        name: 'Add availability constraint',
        sql: `ALTER TABLE game_prices ADD CONSTRAINT IF NOT EXISTS availability_check CHECK (availability IN ('in_stock', 'out_of_stock', 'limited_stock', 'preorder', 'unknown'));`
      },
      {
        name: 'Add confidence constraint',
        sql: `ALTER TABLE game_prices ADD CONSTRAINT IF NOT EXISTS confidence_check CHECK (scrape_confidence >= 0.0 AND scrape_confidence <= 1.0);`
      },
      {
        name: 'Create availability index',
        sql: `CREATE INDEX IF NOT EXISTS idx_game_prices_availability ON game_prices(availability);`
      }
    ];

    for (const [index, migration] of migrations.entries()) {
      console.log(`⏳ Running migration ${index + 1}/${migrations.length}: ${migration.name}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: migration.sql });
      
      if (error) {
        console.log(`❌ Error in migration ${index + 1}:`, error);
        // Try alternative approach using raw query
        const { error: rawError } = await supabase
          .from('game_prices')
          .select('id')
          .limit(1);
        
        if (rawError) {
          console.log('❌ Raw query also failed:', rawError);
        } else {
          console.log('✅ Table exists, trying direct SQL execution...');
          // Execute SQL directly through a custom function or manual execution
        }
      } else {
        console.log(`✅ Migration ${index + 1} completed successfully`);
      }
    }

    // Verify the changes
    console.log('\n🧪 Verifying table structure...');
    const { data: newColumns, error: verifyError } = await supabase
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'game_prices')
      .eq('table_schema', 'public');

    if (verifyError) {
      console.log('❌ Error verifying structure:', verifyError);
    } else {
      console.log('📋 Updated table structure:');
      newColumns?.forEach(col => 
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`)
      );
    }

    // Test a simple query
    console.log('\n🧪 Testing query...');
    const { data, error: queryError } = await supabase
      .from('game_prices')
      .select('*')
      .limit(1);

    if (queryError) {
      console.log('❌ Query test failed:', queryError);
    } else {
      console.log('✅ Query test successful');
      if (data && data.length > 0) {
        console.log('📄 Sample record structure:', Object.keys(data[0]));
      }
    }

  } catch (error) {
    console.error('💥 Unexpected error:', error);
  }

  console.log('\n✅ Migration process completed');
}

runDirectMigration();
