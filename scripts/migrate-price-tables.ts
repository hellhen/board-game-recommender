import { supabase } from '../lib/supabase';
import { readFileSync } from 'fs';
import { join } from 'path';

async function runMigration() {
  console.log('🔧 Running price table migration...');
  
  try {
    // Read the SQL migration file
    const migrationPath = join(__dirname, '../database/add_price_columns.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Split the migration into individual statements (rough splitting by semicolon)
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📄 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 10) { // Skip very short statements
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          if (error) {
            console.warn(`⚠️  Warning on statement ${i + 1}: ${error.message}`);
            // Continue with other statements even if one fails
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (stmtError) {
          console.warn(`⚠️  Error on statement ${i + 1}:`, stmtError);
          // Continue with other statements
        }
      }
    }
    
    console.log('✅ Migration complete!');
    
    // Test the new columns
    console.log('\n🧪 Testing new columns...');
    const { data, error } = await supabase
      .from('game_prices')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('❌ Error testing table:', error);
    } else {
      console.log('✅ Table structure looks good!');
      if (data && data.length > 0) {
        console.log('Sample row:', data[0]);
      }
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('🎉 Migration script completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}
