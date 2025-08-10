# Deployment Guide

## Vercel Deployment (Recommended)

### Quick Deploy
1. Click the "Deploy with Vercel" button in README.md
2. Connect your GitHub account
3. Set environment variables in Vercel dashboard
4. Deploy!

### Manual Vercel Setup

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Link project**:
   ```bash
   vercel
   ```

3. **Set environment variables**:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add OPENAI_API_KEY
   ```

4. **Deploy**:
   ```bash
   vercel --prod
   ```

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for database operations

### Optional
- `OPENAI_API_KEY` - OpenAI API key (app works without this)
- `MODEL` - OpenAI model to use (defaults to gpt-4o-mini)
- `VERCEL_ANALYTICS_ID` - Vercel Analytics tracking ID

## Database Setup

Before deployment, ensure your Supabase database is properly set up:

1. **Create Supabase project** at https://supabase.com
2. **Run database migrations** (if not already done):
   ```sql
   -- Create games table
   CREATE TABLE games (
     id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     title text NOT NULL,
     players text,
     playtime text,
     complexity decimal,
     mechanics text[],
     theme text,
     tags text[],
     description text,
     image_url text,
     bgg_id integer UNIQUE,
     created_at timestamp with time zone DEFAULT now(),
     updated_at timestamp with time zone DEFAULT now()
   );
   
   -- Enable RLS
   ALTER TABLE games ENABLE ROW LEVEL SECURITY;
   
   -- Create policy for public read access
   CREATE POLICY "Allow public read access" ON games
     FOR SELECT USING (true);
   ```

3. **Set up RLS policies**:
   ```bash
   npm run setup:db
   ```

4. **Populate with games** (optional - database comes pre-populated):
   ```bash
   npm run fetch:bgg 100
   ```

## Health Check

After deployment, verify everything is working:

- Visit `https://your-app.vercel.app/api/health` to check system status
- Should return JSON with database connection status and game count

## Troubleshooting

### Common Issues

1. **Database connection fails**:
   - Check Supabase environment variables
   - Verify RLS policies are correctly set up

2. **OpenAI not working**:
   - App will fall back to heuristic recommendations
   - Check OPENAI_API_KEY environment variable

3. **Build fails**:
   - Run `npm run build` locally to test
   - Check all environment variables are set

### Production Considerations

1. **Rate Limiting**: Consider implementing rate limiting for the API endpoints
2. **Caching**: Add caching for game data and recommendations
3. **Monitoring**: Set up monitoring and error tracking
4. **Analytics**: Enable Vercel Analytics for usage insights

## Custom Domain

To use a custom domain with Vercel:

1. Go to Vercel dashboard → Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL will be automatically configured

## CI/CD

The project is configured for automatic deployment on pushes to main branch. To set up:

1. Connect GitHub repository to Vercel
2. Enable automatic deployments
3. Set up preview deployments for pull requests
