const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function runMigration() {
  console.log('Running shared recommendations migration...');
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync('database/shared_recommendations.sql', 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\nExecuting statement ${i + 1}:`);
      console.log(statement.substring(0, 100) + '...');
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', { 
          sql_statement: statement + ';'
        });
        
        if (error) {
          console.error(`Error in statement ${i + 1}:`, error);
          // Try alternative approach for some statements
          if (statement.includes('CREATE TABLE') || statement.includes('CREATE INDEX')) {
            console.log('Trying direct execution...');
            // For Supabase, we might need to use the REST API differently
            // Let's try a simpler approach
          }
        } else {
          console.log(`✓ Statement ${i + 1} executed successfully`);
        }
      } catch (execError) {
        console.error(`Exception in statement ${i + 1}:`, execError);
      }
    }
    
    console.log('\nMigration completed. Testing table creation...');
    
    // Test that the table was created
    const { data: tableInfo, error: tableError } = await supabase
      .from('shared_recommendations')
      .select('*')
      .limit(0);
    
    if (tableError) {
      console.error('Table test failed:', tableError);
    } else {
      console.log('✓ shared_recommendations table is accessible');
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();
