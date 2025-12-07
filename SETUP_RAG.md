# RAG Search Setup Guide

This guide will help you set up semantic search with embeddings for Nexus.

## Prerequisites

1. **Supabase Project** - You should have your Supabase project set up
2. **OpenAI API Key** - For generating embeddings (text-embedding-3-small model)

## Step 1: Set Up Supabase

### Run the SQL Migration

1. Go to your Supabase Dashboard → SQL Editor
2. Open `supabase/setup_vector_search.sql` from this repo
3. Copy and paste the entire SQL script
4. Click **"Run"**

This will:
- Enable the `pgvector` extension
- Add `embedding` column to `x_profiles` table  
- Create an index for fast vector search
- Create `search_profiles()` function for semantic search

## Step 2: Add Environment Variables

Add these to your `.env.local` (already done if you copied from backend):

```env
# OpenAI for embeddings
OPENAI_API_KEY=your_openai_api_key_here

# Supabase (should already be set)
NEXT_PUBLIC_SUPABASE_URL=https://xghtulmjaeephvajpooo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
DATABASE_URL=postgresql://...
```

## Step 3: Generate Embeddings

After you've scraped some profiles, generate embeddings:

### Option A: Via API (Recommended for Vercel)

```bash
# Generate embeddings for 50 profiles at a time
curl -X POST https://your-app.vercel.app/api/embeddings \
  -H "Authorization: Bearer YOUR_NEXTAUTH_SECRET"
```

### Option B: Local Script

Run this multiple times until all profiles are embedded:

```bash
# Check status first
curl https://your-app.vercel.app/api/embeddings

# Then generate
curl -X POST http://localhost:3000/api/embeddings \
  -H "Authorization: Bearer nexus-super-secret-key-12345"
```

### Option C: Inngest Background Job (Future)

You can convert this to an Inngest function to run automatically.

## Step 4: Test the Search

1. Go to your deployed app
2. Click "Nexus Search" in sidebar
3. Try queries like:
   - "people who work in robotics"
   - "AI researchers at Stanford"
   - "founders in climate tech"

## How It Works

### 1. Profile Scraping
When you click "Sync Network", Inngest scrapes profiles from X and stores them in `x_profiles` table.

### 2. Embedding Generation
The `/api/embeddings` endpoint:
- Fetches profiles without embeddings
- Combines name + username + bio into searchable text
- Generates 1536-dimensional vector using OpenAI
- Stores in `embedding` column (pgvector)

### 3. Semantic Search
When you search:
1. Query is converted to embedding vector
2. Supabase compares query vector with profile embeddings using cosine similarity
3. Returns top matches ranked by similarity

## Monitoring

Check embedding progress:
```bash
curl https://your-app.vercel.app/api/embeddings
```

Response:
```json
{
  "total": 1000,
  "embedded": 750,
  "needEmbedding": 250,
  "progress": "75.0%"
}
```

## Costs

- **OpenAI text-embedding-3-small**: $0.02 per 1M tokens
- For 1000 profiles (~100 tokens each): ~$0.002 (very cheap!)
- **Supabase pgvector**: Free on all plans

## Troubleshooting

### "Function search_profiles does not exist"
- Run the SQL migration in Supabase SQL Editor

### "embedding column does not exist"  
- Run the SQL migration
- Or manually: `ALTER TABLE x_profiles ADD COLUMN embedding vector(1536);`

### Search returns no results
- Make sure profiles have embeddings: `curl https://your-app.vercel.app/api/embeddings`
- Generate embeddings: `curl -X POST ...`
- Check Supabase logs for errors

### Rate limits
The embedding endpoint processes 50 profiles at a time with 100ms delays. Run multiple times for large datasets.

## Future Enhancements

- [ ] Add tweet embeddings for deeper search
- [ ] Use Grok API when embeddings become available
- [ ] Automatic embedding generation via Inngest cron
- [ ] Hybrid search (vector + keyword)
- [ ] Filtering by connection degree, followers, etc.

