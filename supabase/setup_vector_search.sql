-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to x_profiles table if it doesn't exist
ALTER TABLE x_profiles 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for faster vector similarity search
CREATE INDEX IF NOT EXISTS x_profiles_embedding_idx 
ON x_profiles USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function to search profiles by vector similarity
CREATE OR REPLACE FUNCTION search_profiles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  x_user_id text,
  username text,
  name text,
  bio text,
  profile_image_url text,
  followers_count int,
  following_count int,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.x_user_id,
    p.username,
    p.name,
    p.bio,
    p.profile_image_url,
    p.followers_count,
    p.following_count,
    1 - (p.embedding <=> query_embedding) as similarity
  FROM x_profiles p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_profiles TO anon, authenticated;

-- Create a function to get profiles that need embedding generation
CREATE OR REPLACE FUNCTION get_profiles_needing_embeddings(batch_size int DEFAULT 100)
RETURNS TABLE (
  x_user_id text,
  username text,
  name text,
  bio text
)
LANGUAGE sql
AS $$
  SELECT x_user_id, username, name, bio
  FROM x_profiles
  WHERE embedding IS NULL
  LIMIT batch_size;
$$;

GRANT EXECUTE ON FUNCTION get_profiles_needing_embeddings TO anon, authenticated;

