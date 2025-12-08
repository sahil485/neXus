import { createClient } from '@supabase/supabase-js';

// Client-side Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side Supabase client (for API routes)
export function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Types for our database tables
export interface XProfile {
  x_user_id: string;
  username: string;
  name: string;
  bio?: string;
  location?: string;
  profile_image_url?: string;
  verified: boolean;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  embedding?: number[]; // pgvector embedding
  last_updated_at: string;
}

export interface XConnection {
  id: string;
  follower_id: string;
  following_id: string;
  discovered_at: string;
}

export interface XTweet {
  tweet_id: string;
  author_id: string;
  content: string;
  created_at: string;
  like_count: number;
  retweet_count: number;
  embedding?: number[]; // pgvector embedding
}

