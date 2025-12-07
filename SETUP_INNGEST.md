# Inngest Background Jobs Setup

This app uses **Inngest** to run long-running scraping jobs in the background without timeout issues.

## What is Inngest?

Inngest is a serverless queue/background job system that runs alongside your Vercel deployment. It's **free** for your use case.

## Setup Steps

### 1. Sign up for Inngest

1. Go to https://www.inngest.com
2. Sign up with GitHub (free)
3. Create a new app called "Nexus"

### 2. Get Your Signing Key

1. In Inngest dashboard, go to **Settings** → **Keys**
2. Copy your **Event Key** and **Signing Key**

### 3. Add to Vercel Environment Variables

Add these to your Vercel project:

```env
INNGEST_EVENT_KEY=your_event_key_here
INNGEST_SIGNING_KEY=your_signing_key_here
```

### 4. Deploy to Vercel

Once deployed, Inngest will automatically detect your functions at:
```
https://your-app.vercel.app/api/inngest
```

### 5. Register Functions with Inngest

1. In Inngest dashboard, click **"Sync app"**
2. Enter your app URL: `https://your-app.vercel.app/api/inngest`
3. Click **"Sync"**

Inngest will discover your background functions!

## How It Works

1. User clicks **"Sync Network"** in dashboard
2. Frontend calls `/api/scrape` (returns immediately)
3. Inngest picks up the job and runs `scrapeNetwork` function
4. Function scrapes Twitter API in chunks (no timeout!)
5. Saves profiles to Supabase

## Local Development

Run Inngest Dev Server:
```bash
npx inngest-cli@latest dev
```

Then start Next.js:
```bash
npm run dev
```

The dev server will show your jobs running in real-time!

