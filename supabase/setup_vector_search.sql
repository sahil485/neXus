-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding and summary columns to x_profiles table
ALTER TABLE x_profiles 
ADD COLUMN IF NOT EXISTS embedding vector(768),
ADD COLUMN IF NOT EXISTS summary TEXT;

-- Create index for faster vector similarity search
DROP INDEX IF EXISTS x_profiles_embedding_idx;
CREATE INDEX x_profiles_embedding_idx 
ON x_profiles USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
-- Drop old functions first
DROP FUNCTION IF EXISTS search_profiles(vector, float, int);
DROP FUNCTION IF EXISTS search_profiles(vector(1536), float, int);
DROP FUNCTION IF EXISTS search_network_profiles(text, vector, float, int);

-- Create function to search profiles within user's network (1st and 2nd degree)
CREATE OR REPLACE FUNCTION search_network_profiles(
  user_id text,
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  x_user_id text,
  username text,
  name text,
  bio text,
  summary text,
  profile_image_url text,
  followers_count int,
  following_count int,
  similarity float,
  degree int
)
LANGUAGE plpgsql
AS $$
DECLARE
  first_degree_ids text[];
  second_degree_ids text[];
BEGIN
  -- Get 1st degree connections (user's mutual_ids)
  SELECT COALESCE(mutual_ids, ARRAY[]::text[]) INTO first_degree_ids
  FROM x_connections
  WHERE x_connections.x_user_id = user_id;
  
  -- Get 2nd degree connections (mutual_ids of 1st degree)
  SELECT ARRAY_AGG(DISTINCT m) INTO second_degree_ids
  FROM x_connections c, UNNEST(c.mutual_ids) AS m
  WHERE c.x_user_id = ANY(first_degree_ids)
    AND m != user_id
    AND NOT (m = ANY(first_degree_ids));
  
  -- Search within network
  RETURN QUERY
  SELECT
    p.x_user_id::text,
    p.username::text,
    p.name::text,
    p.bio::text,
    p.summary::text,
    p.profile_image_url::text,
    p.followers_count::int,
    p.following_count::int,
    (1 - (p.embedding <=> query_embedding))::float as similarity,
    CASE 
      WHEN p.x_user_id = ANY(first_degree_ids) THEN 1
      WHEN p.x_user_id = ANY(second_degree_ids) THEN 2
      ELSE 0
    END as degree
  FROM x_profiles p
  WHERE p.embedding IS NOT NULL
    AND (p.x_user_id = ANY(first_degree_ids) OR p.x_user_id = ANY(COALESCE(second_degree_ids, ARRAY[]::text[])))
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY (1 - (p.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION search_network_profiles TO anon, authenticated;

-- Simple search function for all profiles (fallback)
CREATE OR REPLACE FUNCTION search_profiles(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 20
)
RETURNS TABLE (
  x_user_id text,
  username text,
  name text,
  bio text,
  summary text,
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
    p.x_user_id::text,
    p.username::text,
    p.name::text,
    p.bio::text,
    p.summary::text,
    p.profile_image_url::text,
    p.followers_count::int,
    p.following_count::int,
    (1 - (p.embedding <=> query_embedding))::float as similarity
  FROM x_profiles p
  WHERE p.embedding IS NOT NULL
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY (1 - (p.embedding <=> query_embedding)) DESC
  LIMIT match_count;
END;
$$;

GRANT EXECUTE ON FUNCTION search_profiles TO anon, authenticated;

