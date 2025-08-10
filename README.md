````markdown
# Board Game Sommelier — AI-Powered Game Recommendations

A sophisticated LLM-powered board game recommender with a comprehensive database of 390+ games sourced from BoardGameGeek. Get personalized game recommendations with a sassy sommelier personality!

## 🎯 Features

- **AI-Powered Recommendations**: Uses OpenAI GPT-4 to provide personalized game suggestions
- **Comprehensive Game Database**: 390+ games with full BGG metadata, complexity ratings, and themes
- **Sassy Sommelier Personality**: Brutally honest but helpful recommendations
- **Smart Search**: Semantic search across game mechanics, themes, and descriptions  
- **Fallback Support**: Works with local heuristics when OpenAI isn't available
- **Responsive Design**: Beautiful, modern UI that works on all devices

## 🚀 Live Demo

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hellhen/board-game-recommender)

## 🏗️ Local Development

```bash
# 1) Clone and install
git clone https://github.com/hellhen/board-game-recommender.git
cd board-game-recommelier
npm install

# 2) Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys

# 3) Run development server
npm run dev

# 4) Open browser
http://localhost:3000
```

## 📋 Environment Variables

Create a `.env.local` file with:

```bash
# Required: Supabase Database
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: OpenAI (falls back to heuristics if not provided)
OPENAI_API_KEY=your_openai_api_key
MODEL=gpt-4o-mini

# Optional: Analytics  
VERCEL_ANALYTICS_ID=your_vercel_analytics_id
```

## 🗄️ Database Setup

The app uses Supabase for the game database. The database comes pre-populated with 390+ games, but you can expand it:

```bash
# Check database stats
npm run db:manage stats

# Import more games from BGG
npm run fetch:bgg 100

# Update existing games with BGG metadata
npm run update:bgg

# Set up database policies (first time only)
npm run setup:db
```

## 📁 Project Structure

```
├── app/
│   ├── page.tsx              # Main UI component
│   ├── layout.tsx            # Root layout
│   ├── globals.css           # Global styles
│   └── api/
│       ├── recommend/        # AI recommendation endpoint  
│       └── searchGames/      # Game search endpoint
├── lib/
│   ├── database.ts           # Supabase database functions
│   ├── supabase.ts           # Supabase client config
│   ├── prompt.ts             # AI system prompts
│   └── schema.ts             # TypeScript/Zod schemas
├── scripts/
│   ├── fetch-bgg-games.ts    # BGG import utilities
│   ├── manage-database.ts    # Database management
│   └── update-games-with-bgg.ts # Metadata enhancement
└── data/
    └── games.json            # Fallback game data
```

## 🚀 Deployment

### Vercel (Recommended)

1. **One-click deploy**: Click the "Deploy with Vercel" button above
2. **Set environment variables** in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY` (optional)

3. **Deploy**: Vercel will automatically build and deploy

### Manual Deployment

```bash
# Build for production
npm run build

# Start production server (Node.js)
npm run start
```

## 🎲 Game Database

The recommendation engine is powered by a comprehensive database of board games including:

- **390+ Games** with full metadata from BoardGameGeek
- **Complexity Ratings** from light family games to heavy strategy
- **Detailed Mechanics** and theme categorization
- **Player Counts** and play time information
- **High-quality Images** and descriptions

### Database Stats
- Light games (≤2.0 complexity): 202 games
- Medium games (2.1-3.5 complexity): 139 games  
- Heavy games (3.6+ complexity): 52 games

## 🤖 AI Features

- **Smart Interpretation**: Understands complex requests like "something strategic but not brain-melting"
- **Contextual Recommendations**: Considers group size, experience level, and preferences
- **Honest Reviews**: Sassy sommelier personality provides brutally honest but helpful advice
- **Alternative Suggestions**: Provides backup options and related games

## 🛠️ Development Scripts

```bash
# Development
npm run dev                # Start dev server
npm run build             # Build for production
npm run lint              # Run ESLint

# Database Management  
npm run db:manage stats   # Show database statistics
npm run db:manage cleanup # Clean duplicate entries
npm run setup:db          # Set up RLS policies

# BGG Integration
npm run fetch:bgg 50      # Import 50 games from BGG
npm run update:bgg        # Update existing games with BGG data
npm run import:simple     # Simple BGG import utility
```

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines and submit pull requests for any improvements.

---

Built with ❤️ using Next.js, OpenAI, Supabase, and BoardGameGeek data
````
