# BGG Integration - Database Setup Required

The BGG integration scripts are ready, but we need to configure the database permissions first.

## Current Status
- ✅ BGG fetch scripts created and tested
- ✅ Database management tools ready  
- ✅ Rate limiting and error handling implemented
- ❌ **Database permissions need configuration**

## Issue
Row Level Security (RLS) policies are preventing the import scripts from adding games to the database. This is a security feature of Supabase.

## Solution Options

### Option 1: Temporary RLS Disable (Recommended)
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run this SQL command:
   ```sql
   ALTER TABLE games DISABLE ROW LEVEL SECURITY;
   ```
4. Run the BGG import: `npm run fetch:bgg 25`
5. Re-enable RLS when done:
   ```sql
   ALTER TABLE games ENABLE ROW LEVEL SECURITY;
   ```

### Option 2: Update RLS Policies
1. Go to your Supabase dashboard
2. Navigate to Authentication > Policies
3. Find the "games" table policies
4. Add a new policy that allows service role inserts

### Option 3: Use Supabase CLI (Advanced)
If you have the Supabase CLI installed:
```bash
supabase db reset
# This will reset the database and apply our schema without restrictive policies
```

## After Database Setup

Once permissions are configured, you can:

1. **Check current database stats:**
   ```bash
   npm run db:manage stats
   ```

2. **Fetch games from BGG:**
   ```bash
   npm run fetch:bgg 25    # Start with 25 games
   npm run fetch:bgg 50    # Expand to 50 games
   npm run fetch:bgg 100   # Get 100 games total
   ```

3. **Manage the database:**
   ```bash
   npm run db:manage cleanup  # Remove duplicates
   npm run db:manage update   # Fix metadata
   npm run db:manage all      # Full maintenance
   ```

## What the BGG Integration Provides

- **Automatic game data fetching** from BoardGameGeek API
- **Smart game selection** (hot games + highly-rated classics)
- **Data normalization** (themes, mechanics, tags)
- **Duplicate detection** and cleanup
- **Rate limiting** to respect BGG servers
- **Comprehensive logging** and error handling
- **Database statistics** and maintenance tools

The integration is designed to scale to hundreds or thousands of games while maintaining recommendation quality.

## Next Steps

1. Configure database permissions (use Option 1 above)
2. Test with a small batch: `npm run fetch:bgg 25`
3. Check results: `npm run db:manage stats`
4. Expand the database as needed
5. Use the enhanced recommendation system with a much larger game catalog!

## Support

If you encounter issues:
- Check the console output for detailed error messages
- Use `npm run db:manage stats` to verify database state
- Review the BGG_INTEGRATION.md documentation
- The scripts include comprehensive error handling and will skip problematic games
