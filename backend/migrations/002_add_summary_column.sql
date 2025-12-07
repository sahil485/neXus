-- Add summary and embedding columns to x_profiles
ALTER TABLE x_profiles 
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Add comments
COMMENT ON COLUMN x_profiles.summary IS 'Grok-generated profile summary for RAG embeddings';
COMMENT ON COLUMN x_profiles.embedding IS 'Gemini text-embedding-004 vector (768 dims) of the summary';

