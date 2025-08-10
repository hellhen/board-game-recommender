# Board Game Sommelier — Starter (Next.js)

A tiny starter for an LLM-powered board game recommender.

## Quickstart
```bash
# 1) Install
pnpm i   # or: npm i  /  yarn

# 2) Run dev
pnpm dev

# 3) Open
http://localhost:3000
```

## Environment
Create `.env.local` (optional for now):
```
OPENAI_API_KEY=sk-...
MODEL=gpt-4o-mini
```

If no key is set, the API will use a simple local heuristic over `data/games.json`.

## Files
- `app/page.tsx` — UI
- `app/api/recommend/route.ts` — main endpoint (LLM or local fallback)
- `app/api/searchGames/route.ts` — toy search over local data
- `lib/prompt.ts` — system prompt
- `lib/schema.ts` — zod schema for response
- `data/games.json` — small seed dataset

## Deploy
- Vercel (one-click) or any Node host.
