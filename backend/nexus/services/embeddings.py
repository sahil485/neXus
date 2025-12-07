"""
Embeddings service for generating and managing profile embeddings using Google Gemini.
Profile summaries are first generated using Grok, then embedded.
"""

import os
import asyncio
import httpx
from typing import List, Optional
import google.generativeai as genai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from nexus.db.schema import XProfile


class EmbeddingsService:
    """Service for generating embeddings using Google Gemini API with Grok-generated summaries"""
    
    def __init__(self):
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            raise ValueError("GEMINI_API_KEY not configured in environment")
        
        self.grok_api_key = os.getenv("GROK_API_KEY")
        if not self.grok_api_key:
            raise ValueError("GROK_API_KEY not configured in environment")
        
        genai.configure(api_key=gemini_key)
        self.embedding_model = "models/text-embedding-004"
        self.grok_model = "grok-4-1-fast"
    
    async def generate_profile_summary(self, profile: XProfile, posts: list = None) -> str:
        """Generate a detailed, keyword-rich profile summary using Grok.
        Combines profile info with their posts for comprehensive searchability."""
        profile_text = self.create_profile_text(profile)
        
        # Include posts in the context if available
        posts_text = ""
        if posts and len(posts) > 0:
            # Take up to 10 most recent posts
            sample_posts = posts[:10] if len(posts) > 10 else posts
            posts_text = f"\n\nRecent Posts/Tweets:\n" + "\n---\n".join(sample_posts)
        
        prompt = f"""Analyze this Twitter/X user's profile and posts to create a HIGHLY SEARCHABLE summary.

Your goal: Create a summary packed with KEYWORDS and PHRASES that someone might search to find this person.

Profile Data:
{profile_text}
{posts_text}

INSTRUCTIONS:
1. Extract and include: job titles, company names, industries, technologies, skills, interests, topics they discuss
2. Include relevant keywords like: "AI researcher", "startup founder", "machine learning engineer", "web3 developer", "venture capitalist", "climate tech", etc.
3. Mention specific technologies, frameworks, or tools they work with
4. Include their location and any affiliations (universities, companies, organizations)
5. Note their expertise areas and what they're known for

FORMAT:
- Write 3-4 sentences that are DENSE with searchable keywords
- Then add a "Keywords:" section at the end with 10-15 comma-separated searchable terms

EXAMPLE OUTPUT:
Jane Doe is a machine learning engineer at OpenAI specializing in large language models and AI safety research. Based in San Francisco, she focuses on transformer architectures, RLHF, and responsible AI development. Active contributor to open-source ML projects and speaker at NeurIPS.
Keywords: AI researcher, machine learning engineer, OpenAI, LLM, large language models, AI safety, transformer, RLHF, San Francisco, NeurIPS, open source, deep learning, artificial intelligence, ML engineer

KEYWORD-RICH SUMMARY:"""

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    "https://api.x.ai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.grok_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.grok_model,
                        "messages": [
                            {"role": "system", "content": "You are an expert at creating searchable profile summaries. Your summaries are packed with relevant keywords that help people find professionals through semantic search. Focus on job titles, skills, technologies, industries, and topics."},
                            {"role": "user", "content": prompt}
                        ],
                        "max_tokens": 300,
                        "temperature": 0.5,
                    }
                )
                
                if response.status_code != 200:
                    print(f"Grok API error: {response.status_code} - {response.text}")
                    # Fallback to basic profile text if Grok fails
                    return profile_text + (posts_text if posts_text else "")
                
                data = response.json()
                summary = data['choices'][0]['message']['content'].strip()
                return summary
                
        except Exception as e:
            print(f"Error generating summary with Grok: {e}")
            # Fallback to basic profile text + posts
            return profile_text + (posts_text if posts_text else "")
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a single text string"""
        try:
            result = genai.embed_content(
                model=self.embedding_model,
                content=text,
                task_type="retrieval_document"
            )
            return result['embedding']
        except Exception as e:
            print(f"Error generating embedding: {e}")
            raise
    
    async def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batch processing)"""
        embeddings = []
        for text in texts:
            try:
                embedding = self.generate_embedding(text)
                embeddings.append(embedding)
                # Rate limiting - small delay between requests
                await asyncio.sleep(0.1)
            except Exception as e:
                print(f"Error generating embedding for text: {e}")
                embeddings.append(None)
        return embeddings
    
    @staticmethod
    def create_profile_text(profile: XProfile) -> str:
        """Create searchable text from profile data"""
        parts = []
        
        if profile.name:
            parts.append(profile.name)
        
        if profile.username:
            parts.append(f"@{profile.username}")
        
        if profile.bio:
            parts.append(profile.bio)
        
        if profile.location:
            parts.append(f"Location: {profile.location}")
        
        # Add some context from metrics
        if profile.followers_count > 10000:
            parts.append("influential user")
        
        if profile.verified:
            parts.append("verified account")
        
        return " ".join(parts)
    
    async def generate_embeddings_for_profiles(
        self, 
        db: AsyncSession,
        x_user_ids: Optional[List[str]] = None,
        batch_size: int = 50
    ) -> dict:
        """
        Generate embeddings for profiles in the database.
        
        Args:
            db: Database session
            x_user_ids: Optional list of specific user IDs to process. If None, processes all profiles without embeddings.
            batch_size: Number of profiles to process in each batch
        
        Returns:
            dict with processing statistics
        """
        # Build query
        query = select(XProfile).where(XProfile.embedding.is_(None))
        
        if x_user_ids:
            query = query.where(XProfile.x_user_id.in_(x_user_ids))
        
        query = query.limit(batch_size)
        
        result = await db.execute(query)
        profiles = result.scalars().all()
        
        if not profiles:
            return {
                "processed": 0,
                "errors": 0,
                "message": "No profiles need embeddings"
            }
        
        processed = 0
        errors = 0
        
        for profile in profiles:
            try:
                # Step 1: Generate profile summary using Grok (posts would need to be fetched separately)
                print(f"Generating summary for @{profile.username}...")
                summary = await self.generate_profile_summary(profile, posts=None)
                
                # Step 2: Generate embedding from summary
                print(f"Generating embedding for @{profile.username}...")
                embedding = self.generate_embedding(summary)
                
                # Step 3: Update profile with summary and embedding
                stmt = (
                    update(XProfile)
                    .where(XProfile.x_user_id == profile.x_user_id)
                    .values(summary=summary, embedding=embedding)
                )
                await db.execute(stmt)
                processed += 1
                
                # Rate limiting (both Grok and Gemini need rate limiting)
                await asyncio.sleep(0.5)
                
            except Exception as e:
                print(f"Error processing profile {profile.x_user_id}: {e}")
                errors += 1
        
        await db.commit()
        
        return {
            "processed": processed,
            "errors": errors,
            "total": len(profiles),
            "message": f"Generated embeddings for {processed} profiles"
        }
    
    async def generate_embeddings_for_all_profiles(
        self,
        db: AsyncSession,
        batch_size: int = 50
    ) -> dict:
        """
        Generate embeddings for all profiles without embeddings in the database.
        Processes in batches to avoid memory issues.
        
        Returns:
            dict with total processing statistics
        """
        total_processed = 0
        total_errors = 0
        
        while True:
            result = await self.generate_embeddings_for_profiles(db, batch_size=batch_size)
            
            total_processed += result["processed"]
            total_errors += result["errors"]
            
            # If we processed fewer profiles than batch_size, we're done
            if result["processed"] < batch_size:
                break
            
            print(f"Batch complete. Total processed so far: {total_processed}")
        
        return {
            "total_processed": total_processed,
            "total_errors": total_errors,
            "message": f"Generated embeddings for {total_processed} profiles with {total_errors} errors"
        }

