# BGG Database Integration

This document explains how to expand your board game database by fetching games from BoardGameGeek (BGG).

## Setup Required

Before running BGG imports, you need to set up proper database permissions:

### 1. Test Current Access
```bash
npm run setup:db
```

### 2. Fix Database Policies (if needed)
If the test shows permission errors, generate the SQL fix:
```bash
npm run setup:db sql
```

Then:
1. Copy the generated SQL
2. Go to your Supabase dashboard → SQL Editor
3. Paste and run the SQL
4. Test again with `npm run setup:db`

## Available Scripts

### Fetch BGG Games
```bash
npm run fetch:bgg [number]
```
Fetches games from BGG and adds them to your database. The optional number parameter specifies how many games to fetch (default: 50).

**Examples:**
```bash
npm run fetch:bgg          # Fetch 50 games
npm run fetch:bgg 100      # Fetch 100 games  
npm run fetch:bgg 25       # Fetch 25 games
```

### Database Management
```bash
npm run db:manage <command>
```

Available commands:
- `stats` - Show database statistics and distribution
- `cleanup` - Remove duplicate games
- `update` - Update missing metadata
- `all` - Run all management tasks

**Examples:**
```bash
npm run db:manage stats    # Show current database stats
npm run db:manage cleanup  # Remove duplicates
npm run db:manage all      # Full maintenance
```

## How It Works

### Data Sources
The BGG integration pulls from two sources:
1. **Hot Games List** - Currently trending games on BGG
2. **Popular Games** - Curated list of highly-rated classics and modern favorites

### Data Processing
Each game fetched from BGG includes:
- Basic info (title, players, playtime, complexity)
- Mechanics and categories
- Descriptions and images  
- Ratings and rankings
- Designer and publisher information

The script automatically:
- Normalizes BGG mechanics to our simplified format
- Categorizes themes based on BGG categories
- Generates appropriate tags based on game characteristics
- Formats player counts and playtime consistently
- Skips games that already exist in the database

### Rate Limiting
The script includes respectful rate limiting (2 seconds between requests) to avoid overloading BGG's servers.

## Database Schema

Games are stored with the following fields:
- `bgg_id` - BoardGameGeek ID for reference
- `title` - Game name
- `players` - Formatted player count (e.g., "2–4 (best 3)")
- `playtime` - Formatted playtime (e.g., "30–45 min")
- `complexity` - BGG weight rating (1-5 scale)
- `mechanics` - Array of normalized mechanics
- `theme` - Categorized theme
- `tags` - Auto-generated tags based on game characteristics
- `description` - Game description (truncated to 500 chars)
- `image_url` - Game box art URL

## Quality Control

The integration includes several quality control measures:
- Duplicate detection (by BGG ID and title)
- Data validation and normalization
- Error handling and retry logic
- Comprehensive logging

## Best Practices

1. **Start Small** - Begin with 25-50 games to test the integration
2. **Monitor Progress** - Watch the console output for any errors
3. **Check Stats** - Use `npm run db:manage stats` to verify results
4. **Clean Regularly** - Run `npm run db:manage cleanup` periodically

## Troubleshooting

**Common Issues:**

1. **Network Timeouts** - BGG API can be slow; this is normal
2. **Rate Limiting** - The script includes delays; don't modify them
3. **XML Parsing Errors** - Some games may have malformed data; these are skipped
4. **Database Errors** - Check your Supabase connection and permissions

**If You Encounter Problems:**
- Check your internet connection
- Verify your Supabase credentials are correct
- Run `npm run db:manage stats` to check current state
- Try fetching a smaller number of games first

## Expanding Further

To add more games beyond the initial fetch:
1. Run the fetch command with additional games
2. The script will automatically skip duplicates
3. Use database management tools to maintain quality

The system is designed to scale to thousands of games while maintaining performance and recommendation quality.
