"""
Graph Intelligence routes - topic clustering and natural language filtering
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from supabase import create_client, Client
from nexus.services.embeddings import EmbeddingsService
import numpy as np
from collections import defaultdict

router = APIRouter(tags=["graph_intelligence"])


class TopicClusterRequest(BaseModel):
    x_user_id: str  # The signed-in user's ID


class TopicClusterResponse(BaseModel):
    user_id: str
    username: str
    name: str
    topic: str
    topic_confidence: float


class NaturalLanguageSearchRequest(BaseModel):
    x_user_id: str  # The signed-in user's ID
    query: str  # Natural language query like "Show me founders in AI"
    limit: int = 50


class NaturalLanguageSearchResponse(BaseModel):
    user_id: str
    username: str
    name: str
    relevance_score: float
    reason: str


# Predefined topic keywords for clustering
TOPIC_KEYWORDS = {
    "AI & Machine Learning": ["ai", "artificial intelligence", "machine learning", "ml", "deep learning", "llm", "gpt", "neural", "data science"],
    "Crypto & Web3": ["crypto", "blockchain", "web3", "nft", "defi", "ethereum", "bitcoin", "token", "dao"],
    "Startups & Founders": ["founder", "ceo", "startup", "entrepreneur", "building", "launched", "cofounder", "indie hacker"],
    "Design & Creative": ["designer", "design", "ui", "ux", "product design", "creative", "visual", "illustration", "brand"],
    "Engineering": ["engineer", "developer", "software", "code", "programming", "backend", "frontend", "full stack", "devops"],
    "Finance & Investing": ["investor", "vc", "venture capital", "finance", "trading", "markets", "investment", "angel"],
    "Marketing & Growth": ["marketing", "growth", "seo", "content", "social media", "brand", "community", "product marketing"],
    "Research & Academia": ["researcher", "phd", "professor", "academic", "research", "scientist", "scholar", "university"],
    "Media & Content": ["writer", "journalist", "content creator", "podcaster", "youtuber", "blogger", "author", "editor"],
    "General Tech": ["tech", "technology", "innovation", "digital", "software", "product", "saas"]
}

# Color scheme for topics (will be used in frontend)
TOPIC_COLORS = {
    "AI & Machine Learning": "#8b5cf6",  # Purple
    "Crypto & Web3": "#f59e0b",  # Amber
    "Startups & Founders": "#ef4444",  # Red
    "Design & Creative": "#ec4899",  # Pink
    "Engineering": "#3b82f6",  # Blue
    "Finance & Investing": "#10b981",  # Green
    "Marketing & Growth": "#f97316",  # Orange
    "Research & Academia": "#6366f1",  # Indigo
    "Media & Content": "#14b8a6",  # Teal
    "General Tech": "#6b7280"  # Gray
}


def classify_topic(bio: str, summary: str = "") -> tuple[str, float]:
    """
    Classify a user into a topic based on their bio and summary.
    Returns (topic_name, confidence_score)
    """
    if not bio and not summary:
        return "General Tech", 0.3
    
    text = f"{bio} {summary}".lower()
    
    # Score each topic
    topic_scores = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for keyword in keywords if keyword in text)
        if score > 0:
            # Normalize by keyword count to get confidence
            topic_scores[topic] = score / len(keywords)
    
    if not topic_scores:
        return "General Tech", 0.3
    
    # Get best matching topic
    best_topic = max(topic_scores, key=topic_scores.get)
    confidence = topic_scores[best_topic]
    
    return best_topic, min(confidence * 2, 1.0)  # Scale up confidence


@router.post("/topics/cluster", response_model=List[TopicClusterResponse])
async def cluster_by_topics(request: TopicClusterRequest):
    """
    Analyze network profiles and cluster them by semantic topics.
    Returns topic assignment for each user in the network.
    """
    try:
        # Connect to Supabase
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        user_id = request.x_user_id
        
        print(f"🎨 Clustering topics for user {user_id}...")
        
        # Get 1st degree connections
        first_degree_response = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', user_id).execute()
        
        first_degree_ids = []
        if first_degree_response.data and len(first_degree_response.data) > 0:
            first_degree_ids = first_degree_response.data[0].get('mutual_ids', []) or []
        
        # Get 2nd degree connections
        second_degree_ids = set()
        if first_degree_ids:
            for i in range(0, len(first_degree_ids), 50):
                batch_ids = first_degree_ids[i:i+50]
                second_response = supabase.table('x_connections').select('mutual_ids').in_('x_user_id', batch_ids).execute()
                
                if second_response.data:
                    for conn in second_response.data:
                        mutual = conn.get('mutual_ids', []) or []
                        second_degree_ids.update(mutual)
        
        second_degree_ids.discard(user_id)
        second_degree_ids -= set(first_degree_ids)
        
        all_profile_ids = list(set(first_degree_ids) | second_degree_ids)
        
        if not all_profile_ids:
            return []
        
        # Get all profiles with their bios and summaries
        results = []
        for i in range(0, len(all_profile_ids), 100):
            batch_ids = all_profile_ids[i:i+100]
            response = supabase.table('x_profiles').select('x_user_id, username, name, bio, summary').in_('x_user_id', batch_ids).execute()
            
            if response.data:
                for profile in response.data:
                    bio = profile.get('bio', '') or ''
                    summary = profile.get('summary', '') or ''
                    
                    topic, confidence = classify_topic(bio, summary)
                    
                    results.append(TopicClusterResponse(
                        user_id=profile['x_user_id'],
                        username=profile['username'],
                        name=profile['name'],
                        topic=topic,
                        topic_confidence=confidence
                    ))
        
        print(f"✅ Clustered {len(results)} profiles into topics")
        return results
        
    except Exception as e:
        print(f"Topic clustering error: {e}")
        raise HTTPException(status_code=500, detail=f"Topic clustering failed: {str(e)}")


@router.post("/search/natural-language", response_model=List[NaturalLanguageSearchResponse])
async def natural_language_search(request: NaturalLanguageSearchRequest):
    """
    Search the network using natural language queries.
    Examples: "Show me founders in AI", "Find designers", "Who works in crypto?"
    Falls back to keyword search if embeddings are not available.
    """
    try:
        # Connect to Supabase
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        user_id = request.x_user_id
        query = request.query.lower()
        
        print(f"🔍 Natural language search: '{query}'")
        
        # Get 1st and 2nd degree connections
        first_degree_response = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', user_id).execute()
        
        first_degree_ids = []
        if first_degree_response.data and len(first_degree_response.data) > 0:
            first_degree_ids = first_degree_response.data[0].get('mutual_ids', []) or []
        
        second_degree_ids = set()
        if first_degree_ids:
            for i in range(0, len(first_degree_ids), 50):
                batch_ids = first_degree_ids[i:i+50]
                second_response = supabase.table('x_connections').select('mutual_ids').in_('x_user_id', batch_ids).execute()
                
                if second_response.data:
                    for conn in second_response.data:
                        mutual = conn.get('mutual_ids', []) or []
                        second_degree_ids.update(mutual)
        
        second_degree_ids.discard(user_id)
        second_degree_ids -= set(first_degree_ids)
        
        all_profile_ids = list(set(first_degree_ids) | second_degree_ids)
        
        if not all_profile_ids:
            return []
        
        results = []
        
        # Check if we have embeddings available
        try:
            embeddings_service = EmbeddingsService()
            query_embedding = embeddings_service.generate_embedding(query)
            use_embeddings = True
            print("✅ Using semantic search with embeddings")
        except Exception as e:
            print(f"⚠️ Embeddings not available, falling back to keyword search: {e}")
            use_embeddings = False
        
        # Get all profiles
        for i in range(0, len(all_profile_ids), 100):
            batch_ids = all_profile_ids[i:i+100]
            
            if use_embeddings:
                # Try semantic search with embeddings
                response = supabase.table('x_profiles').select('x_user_id, username, name, bio, summary, embedding').in_('x_user_id', batch_ids).not_.is_('embedding', None).execute()
            else:
                # Fallback to keyword search (no embedding needed)
                response = supabase.table('x_profiles').select('x_user_id, username, name, bio, summary').in_('x_user_id', batch_ids).execute()
            
            if response.data:
                for profile in response.data:
                    bio = profile.get('bio', '') or ''
                    summary = profile.get('summary', '') or ''
                    name = profile.get('name', '') or ''
                    username = profile.get('username', '') or ''
                    
                    # Create searchable text
                    text = f"{bio} {summary} {name} {username}".lower()
                    
                    # Calculate relevance score
                    if use_embeddings and profile.get('embedding'):
                        try:
                            embedding = profile.get('embedding')
                            # Calculate cosine similarity
                            similarity = np.dot(query_embedding, embedding) / (
                                np.linalg.norm(query_embedding) * np.linalg.norm(embedding)
                            )
                            
                            # Also do keyword matching for better results
                            keyword_match = any(word in text for word in query.split())
                            
                            # Boost score if keyword match
                            final_score = similarity * 1.5 if keyword_match else similarity
                        except:
                            # If embedding calculation fails, fall back to keyword matching
                            final_score = sum(1 for word in query.split() if word in text) / max(len(query.split()), 1)
                    else:
                        # Keyword-based scoring
                        query_words = query.split()
                        matches = sum(1 for word in query_words if word in text)
                        final_score = matches / max(len(query_words), 1)
                    
                    # Filter by threshold
                    threshold = 0.3 if use_embeddings else 0.1
                    if final_score > threshold:
                        # Generate a reason
                        reason = summary[:100] if summary else bio[:100] if bio else f"{name} (@{username})"
                        
                        results.append(NaturalLanguageSearchResponse(
                            user_id=profile['x_user_id'],
                            username=profile['username'],
                            name=profile['name'],
                            relevance_score=float(final_score),
                            reason=reason
                        ))
        
        # Sort by relevance score
        results.sort(key=lambda x: x.relevance_score, reverse=True)
        
        # Return top results
        results = results[:request.limit]
        
        search_type = "semantic" if use_embeddings else "keyword"
        print(f"✅ Found {len(results)} matching profiles using {search_type} search")
        return results
        
    except Exception as e:
        print(f"Natural language search error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/topics/colors")
async def get_topic_colors():
    """Get the color scheme for topics"""
    return {
        "topics": list(TOPIC_KEYWORDS.keys()),
        "colors": TOPIC_COLORS
    }
