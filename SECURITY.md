# Security Guide

## Environment Variables

### Required Setup
1. Copy `.env.local.example` to `.env.local`
2. Fill in your actual API keys and credentials
3. **NEVER commit `.env.local` to version control**

### API Keys Required
- `OPENAI_API_KEY`: Your OpenAI API key for recommendations
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key

## Security Measures Implemented

### ✅ Fixed (Priority 1)
- [x] Dependencies updated to fix critical vulnerabilities
- [x] Environment variables properly protected
- [x] .env.local.example template provided
- [x] No sensitive data in repository

### 🚧 Current Security Features
- Input validation using Zod schemas
- Supabase Row Level Security (RLS) enabled
- Rate limiting on recommendation API (10 seconds per IP)
- File-based sharing with random 8-character IDs
- TypeScript for type safety
- HTTPS-only remote image patterns
- Powered-by header disabled

### ⚠️ Known Limitations (To Be Addressed)
- Rate limiting is in-memory (resets on server restart)
- Shared files have no expiration or cleanup
- No request size limits on share API
- File storage doesn't have access controls beyond random IDs

## Best Practices

### For Development
1. Never commit `.env.local` files
2. Rotate API keys if accidentally exposed
3. Use environment-specific configurations
4. Keep dependencies updated

### For Production
1. Use environment variables in your hosting platform
2. Enable HTTPS only
3. Consider implementing Redis-based rate limiting
4. Monitor API usage and costs
5. Implement proper logging and alerting

## Reporting Security Issues
If you find a security vulnerability, please report it responsibly by:
1. Not posting it in public issues
2. Contacting the maintainers directly
3. Providing clear reproduction steps

## Emergency Procedures

### If API Keys Are Exposed
1. **Immediately rotate all exposed keys**
2. **Remove from version control history if committed**
3. **Monitor usage for unauthorized access**
4. **Update all deployment environments**

### Steps to Rotate Keys
1. **OpenAI**: Go to https://platform.openai.com/api-keys
2. **Supabase**: Go to your project Settings > API
3. **Update all environments** (development, staging, production)
4. **Test thoroughly** after key rotation
