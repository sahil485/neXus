"""
Influence Pathways - Multi-factor bridge ranking and introduction routing
Builds on existing graph intelligence infrastructure
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import numpy as np
from supabase import create_client, Client
from collections import defaultdict

router = APIRouter(tags=["influence_pathways"])


class PathwayRequest(BaseModel):
    x_user_id: str  # Your user ID
    target_user_id: str  # Person you want to reach


class BridgeScore(BaseModel):
    bridge_user_id: str
    bridge_username: str
    bridge_name: str
    bridge_profile_image: str
    overall_score: float
    success_probability: float
    
    # Component scores
    relationship_strength_your_side: float  # How well YOU know the bridge
    relationship_strength_their_side: float  # How well BRIDGE knows target
    topic_alignment: float
    influence_score: float
    engagement_quality: float
    
    # Insights
    reason: str
    suggested_approach: str


class PathwayResponse(BaseModel):
    target_user_id: str
    target_username: str
    target_name: str
    target_bio: str
    bridges: List[BridgeScore]
    total_bridges_found: int


def calculate_embedding_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """Calculate cosine similarity between two embeddings"""
    if not embedding1 or not embedding2:
        return 0.0
    
    vec1 = np.array(embedding1)
    vec2 = np.array(embedding2)
    
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))


def calculate_influence_score(profile: dict) -> float:
    """Score bridge influence (0-100)"""
    followers = profile.get('followers_count', 0)
    verified = profile.get('verified', False)
    
    # Log scale for followers
    follower_score = min(100, (np.log10(followers + 10) / 6) * 100)
    
    # Bonus for verification
    if verified:
        follower_score = min(100, follower_score * 1.2)
    
    return follower_score


def calculate_engagement_quality(profile: dict) -> float:
    """
    Estimate how likely they are to help with intros
    Based on activity level and account health
    """
    followers = profile.get('followers_count', 0)
    following = profile.get('following_count', 0)
    tweets = profile.get('tweet_count', 0)
    
    # Ratio analysis (1:1 is ideal for mutual engagement)
    if followers > 0:
        ratio = following / followers
        ratio_score = 100 * (1 - abs(ratio - 1)) if ratio < 2 else 30
    else:
        ratio_score = 50
    
    # Activity score (more tweets = more active)
    activity_score = min(100, (np.log10(tweets + 10) / 5) * 100)
    
    # Protected accounts unlikely to help
    if profile.get('is_protected', False):
        return 0
    
    return (ratio_score * 0.4 + activity_score * 0.6)


def generate_introduction_message(
    your_name: str,
    bridge_name: str,
    target_name: str,
    target_bio: str,
    shared_topics: List[str]
) -> str:
    """Generate suggested approach for introduction request"""
    
    if shared_topics:
        topic_str = shared_topics[0]
        return f"Hi {bridge_name}, noticed you both work in {topic_str}. I'm exploring [your project] and would love to connect with {target_name} about [specific aspect]. Would you be open to an intro?"
    
    return f"Hi {bridge_name}, saw you're connected with {target_name}. I'd love to connect about [topic of mutual interest]. Would you be open to making an introduction?"


@router.post("/pathways/analyze", response_model=PathwayResponse)
async def analyze_influence_pathways(request: PathwayRequest):
    """
    Find all bridges to target and rank by introduction quality
    Uses existing embeddings, profiles, and connection data
    """
    try:
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        print(f"🔍 Finding pathways from {request.x_user_id} to {request.target_user_id}")
        
        # Step 1: Get YOUR 1st degree connections
        your_connections_response = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', request.x_user_id).execute()
        
        if not your_connections_response.data or len(your_connections_response.data) == 0:
            raise HTTPException(status_code=404, detail="No connections found for user")
        
        your_1st_degree = set(your_connections_response.data[0].get('mutual_ids', []) or [])
        
        # Step 2: Get TARGET's connections to find mutual bridges
        target_connections_response = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', request.target_user_id).execute()
        
        if not target_connections_response.data or len(target_connections_response.data) == 0:
            # Target might be 2nd degree - check if any of your 1st degree connects to them
            bridges = []
            for first_deg_id in list(your_1st_degree)[:100]:  # Sample to avoid huge query
                conn_resp = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', first_deg_id).execute()
                if conn_resp.data and len(conn_resp.data) > 0:
                    their_connections = set(conn_resp.data[0].get('mutual_ids', []) or [])
                    if request.target_user_id in their_connections:
                        bridges.append(first_deg_id)
            
            if not bridges:
                raise HTTPException(status_code=404, detail="No path found to target user")
            
            mutual_bridges = set(bridges)
        else:
            target_connections = set(target_connections_response.data[0].get('mutual_ids', []) or [])
            
            # Step 3: Find intersection (mutual bridges)
            mutual_bridges = your_1st_degree & target_connections
        
        if not mutual_bridges:
            raise HTTPException(status_code=404, detail="No mutual connections found between you and target")
        
        print(f"📊 Found {len(mutual_bridges)} potential bridges")
        
        # Step 4: Get profiles with embeddings for all parties
        all_ids = list(mutual_bridges) + [request.x_user_id, request.target_user_id]
        
        profiles_response = supabase.table('x_profiles').select('*').in_('x_user_id', all_ids).execute()
        
        if not profiles_response.data:
            raise HTTPException(status_code=404, detail="Profile data not found")
        
        # Create lookup dict
        profiles_dict = {p['x_user_id']: p for p in profiles_response.data}
        
        your_profile = profiles_dict.get(request.x_user_id)
        target_profile = profiles_dict.get(request.target_user_id)
        
        if not target_profile:
            raise HTTPException(status_code=404, detail="Target profile not found")
        
        # Step 5: Score each bridge
        scored_bridges = []
        
        your_embedding = your_profile.get('embedding') if your_profile else None
        target_embedding = target_profile.get('embedding')
        
        for bridge_id in mutual_bridges:
            bridge_profile = profiles_dict.get(bridge_id)
            if not bridge_profile:
                continue
            
            bridge_embedding = bridge_profile.get('embedding')
            
            # === SCORING COMPONENTS ===
            
            # 1. Topic alignment (using existing embeddings!)
            if bridge_embedding and target_embedding:
                topic_alignment = calculate_embedding_similarity(bridge_embedding, target_embedding) * 100
            else:
                topic_alignment = 50.0  # Neutral if no embeddings
            
            # 2. Your relationship with bridge (we don't have interaction data yet, use followers as proxy)
            your_relationship = min(100, (bridge_profile.get('followers_count', 0) / 1000) * 10)
            
            # 3. Bridge relationship with target (similar proxy)
            bridge_relationship = topic_alignment  # Use topic alignment as proxy for relationship
            
            # 4. Influence score
            influence = calculate_influence_score(bridge_profile)
            
            # 5. Engagement quality
            engagement = calculate_engagement_quality(bridge_profile)
            
            # === COMBINED SCORE ===
            # Weighted average (you can tune these weights)
            overall_score = (
                topic_alignment * 0.30 +      # Most important: do they work in same space?
                bridge_relationship * 0.25 +  # Do bridge and target know each other well?
                influence * 0.20 +            # Is bridge influential?
                engagement * 0.15 +           # Is bridge active/helpful?
                your_relationship * 0.10      # How well do you know bridge?
            )
            
            # Success probability (simplified model)
            success_probability = min(95, overall_score * 0.85)
            
            # Generate insights
            reasons = []
            if topic_alignment > 70:
                reasons.append(f"Strong topic alignment ({topic_alignment:.0f}/100)")
            if influence > 80:
                reasons.append(f"Highly influential ({int(bridge_profile.get('followers_count', 0)):,} followers)")
            if engagement > 70:
                reasons.append("Active and engaged on X")
            
            if not reasons:
                reasons.append("Mutual connection available")
            
            reason = " • ".join(reasons)
            
            # Suggested approach
            suggested_approach = generate_introduction_message(
                your_profile.get('name', 'You') if your_profile else 'You',
                bridge_profile.get('name', ''),
                target_profile.get('name', ''),
                target_profile.get('bio', ''),
                []  # Could extract topics from embeddings/summaries
            )
            
            scored_bridges.append(BridgeScore(
                bridge_user_id=bridge_id,
                bridge_username=bridge_profile.get('username', ''),
                bridge_name=bridge_profile.get('name', ''),
                bridge_profile_image=bridge_profile.get('profile_image_url', ''),
                overall_score=overall_score,
                success_probability=success_probability,
                relationship_strength_your_side=your_relationship,
                relationship_strength_their_side=bridge_relationship,
                topic_alignment=topic_alignment,
                influence_score=influence,
                engagement_quality=engagement,
                reason=reason,
                suggested_approach=suggested_approach
            ))
        
        # Sort by overall score (best first)
        scored_bridges.sort(key=lambda x: x.overall_score, reverse=True)
        
        print(f"✅ Ranked {len(scored_bridges)} bridges")
        
        return PathwayResponse(
            target_user_id=request.target_user_id,
            target_username=target_profile.get('username', ''),
            target_name=target_profile.get('name', ''),
            target_bio=target_profile.get('bio', ''),
            bridges=scored_bridges,
            total_bridges_found=len(scored_bridges)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Pathway analysis error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pathway analysis failed: {str(e)}")


@router.get("/pathways/quick-score/{bridge_id}/{target_id}")
async def quick_score_bridge(bridge_id: str, target_id: str):
    """
    Quick score for a specific bridge-target pair
    Useful for real-time UI updates
    """
    try:
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Get both profiles
        profiles = supabase.table('x_profiles').select('*').in_('x_user_id', [bridge_id, target_id]).execute()
        
        if not profiles.data or len(profiles.data) < 2:
            raise HTTPException(status_code=404, detail="Profiles not found")
        
        profiles_dict = {p['x_user_id']: p for p in profiles.data}
        bridge = profiles_dict[bridge_id]
        target = profiles_dict[target_id]
        
        # Calculate quick score
        topic_alignment = 0.0
        if bridge.get('embedding') and target.get('embedding'):
            topic_alignment = calculate_embedding_similarity(
                bridge['embedding'],
                target['embedding']
            ) * 100
        
        influence = calculate_influence_score(bridge)
        engagement = calculate_engagement_quality(bridge)
        
        score = (topic_alignment * 0.4 + influence * 0.3 + engagement * 0.3)
        
        return {
            "bridge_id": bridge_id,
            "target_id": target_id,
            "score": score,
            "topic_alignment": topic_alignment,
            "influence": influence,
            "engagement": engagement
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
