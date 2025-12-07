"""
RAG generation route - generates summaries and embeddings for existing profiles
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
import asyncio
from supabase import create_client, Client
from nexus.services.embeddings import EmbeddingsService

router = APIRouter(tags=["rag"])


class RAGGenerateRequest(BaseModel):
    x_user_id: str  # The signed-in user's ID


BATCH_SIZE = 500  # Process 500 profiles in parallel


@router.post("/generate")
async def generate_rag(request: RAGGenerateRequest):
    """
    Generate Grok summaries and Gemini embeddings for 1st and 2nd degree connections.
    Processes 500 at a time in parallel. Skips profiles that already have embeddings.
    """
    try:
        # Connect to Supabase
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        embeddings_service = EmbeddingsService()
        
        user_id = request.x_user_id
        print(f"🔍 Finding 1st and 2nd degree connections for user {user_id}...")
        
        # Step 1: Get 1st degree connections (user's mutual_ids)
        first_degree_response = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', user_id).execute()
        
        first_degree_ids = []
        if first_degree_response.data and len(first_degree_response.data) > 0:
            first_degree_ids = first_degree_response.data[0].get('mutual_ids', []) or []
        
        print(f"📊 Found {len(first_degree_ids)} 1st degree connections")
        
        # Step 2: Get 2nd degree connections (mutual_ids of 1st degree connections)
        second_degree_ids = set()
        if first_degree_ids:
            # Get connections for all 1st degree in batches
            for i in range(0, len(first_degree_ids), 50):
                batch_ids = first_degree_ids[i:i+50]
                second_response = supabase.table('x_connections').select('mutual_ids').in_('x_user_id', batch_ids).execute()
                
                if second_response.data:
                    for conn in second_response.data:
                        mutual = conn.get('mutual_ids', []) or []
                        second_degree_ids.update(mutual)
        
        # Remove user and 1st degree from 2nd degree (avoid duplicates)
        second_degree_ids.discard(user_id)
        second_degree_ids -= set(first_degree_ids)
        
        print(f"📊 Found {len(second_degree_ids)} 2nd degree connections")
        
        # Combine all profile IDs to process
        all_profile_ids = list(set(first_degree_ids) | second_degree_ids)
        print(f"📊 Total unique profiles to check: {len(all_profile_ids)}")
        
        total_processed = 0
        total_errors = 0
        batch_num = 0
        
        # Helper class for profile data
        class ProfileObj:
            def __init__(self, data):
                self.name = data.get('name')
                self.username = data.get('username')
                self.bio = data.get('bio')
                self.location = data.get('location')
                self.followers_count = data.get('followers_count', 0)
                self.verified = data.get('verified', False)
                self.x_user_id = data.get('x_user_id')
        
        # Pre-fetch all posts for the profiles we'll process
        print("📝 Fetching posts for all profiles...")
        posts_map = {}
        for i in range(0, len(all_profile_ids), BATCH_SIZE):
            batch_ids = all_profile_ids[i:i+BATCH_SIZE]
            posts_response = supabase.table('x_posts').select('x_user_id, posts').in_('x_user_id', batch_ids).execute()
            if posts_response.data:
                for post_data in posts_response.data:
                    posts_map[post_data['x_user_id']] = post_data.get('posts', [])
        print(f"📝 Found posts for {len(posts_map)} profiles")
        
        # Clear embeddings AND summaries for profiles that have posts (so they get regenerated with post content)
        profiles_with_posts = list(posts_map.keys())
        if profiles_with_posts:
            print(f"🔄 Clearing embeddings for {len(profiles_with_posts)} profiles with posts to regenerate with post content...")
            for i in range(0, len(profiles_with_posts), BATCH_SIZE):
                batch_ids = profiles_with_posts[i:i+BATCH_SIZE]
                supabase.table('x_profiles').update({
                    'summary': None,
                    'embedding': None
                }).in_('x_user_id', batch_ids).execute()
        
        async def process_single_profile(profile):
            """Process a single profile - generate summary (with posts) and embedding"""
            try:
                profile_obj = ProfileObj(profile)
                
                # Get posts for this user
                user_posts = posts_map.get(profile['x_user_id'], [])
                
                # Always regenerate summary to include posts
                summary = await embeddings_service.generate_profile_summary(profile_obj, posts=user_posts)
                
                # Generate embedding from summary
                embedding = embeddings_service.generate_embedding(summary)
                
                # Update profile in Supabase
                supabase.table('x_profiles').update({
                    'summary': summary,
                    'embedding': embedding
                }).eq('x_user_id', profile['x_user_id']).execute()
                
                return {"success": True, "username": profile['username'], "has_posts": len(user_posts) > 0}
                
            except Exception as e:
                print(f"✗ Error @{profile.get('username')}: {e}")
                return {"success": False, "username": profile.get('username'), "error": str(e)}
        
        # Keep track of which profiles still need processing
        profiles_to_process = all_profile_ids.copy()
        
        # Keep processing batches of BATCH_SIZE until no more profiles need processing
        while profiles_to_process:
            batch_num += 1
            
            # Get next batch of profile IDs
            batch_ids = profiles_to_process[:BATCH_SIZE]
            profiles_to_process = profiles_to_process[BATCH_SIZE:]
            
            # Get profiles WITHOUT embeddings from this batch (need to regenerate)
            response = supabase.table('x_profiles').select('*').in_('x_user_id', batch_ids).is_('embedding', None).execute()
            
            if not response.data or len(response.data) == 0:
                print(f"📦 Batch {batch_num}: All {len(batch_ids)} profiles in batch already have embeddings, skipping...")
                continue
            
            profiles = response.data
            print(f"📦 Batch {batch_num}: Processing {len(profiles)} profiles in parallel (skipped {len(batch_ids) - len(profiles)} with embeddings)...")
            
            # Process all profiles in this batch in parallel
            results = await asyncio.gather(*[process_single_profile(p) for p in profiles])
            
            # Count successes and failures
            batch_processed = sum(1 for r in results if r["success"])
            batch_errors = sum(1 for r in results if not r["success"])
            
            total_processed += batch_processed
            total_errors += batch_errors
            
            print(f"📦 Batch {batch_num} complete: {batch_processed} success, {batch_errors} errors")
            
            # Small delay between batches to avoid rate limits
            await asyncio.sleep(0.5)
        
        return {
            "success": True,
            "processed": total_processed,
            "errors": total_errors,
            "batches": batch_num,
            "message": f"Generated summaries and embeddings for {total_processed} profiles in {batch_num} batches"
        }
        
    except Exception as e:
        print(f"RAG generation error: {e}")
        raise HTTPException(status_code=500, detail=f"RAG generation failed: {str(e)}")


class RAGRegenerateRequest(BaseModel):
    x_user_id: str  # The signed-in user's ID
    force: bool = True  # Force regenerate even if embeddings exist


@router.post("/regenerate")
async def regenerate_rag(request: RAGRegenerateRequest):
    """
    Force regenerate all summaries and embeddings for 1st and 2nd degree connections.
    Useful when posts have been updated and you want to refresh the search index.
    """
    try:
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        embeddings_service = EmbeddingsService()
        
        user_id = request.x_user_id
        print(f"🔄 Force regenerating RAG for user {user_id}...")
        
        # Get 1st degree connections
        first_degree_response = supabase.table('x_connections').select('mutual_ids').eq('x_user_id', user_id).execute()
        first_degree_ids = first_degree_response.data[0].get('mutual_ids', []) if first_degree_response.data else []
        
        # Get 2nd degree connections
        second_degree_ids = set()
        for i in range(0, len(first_degree_ids), 50):
            batch_ids = first_degree_ids[i:i+50]
            second_response = supabase.table('x_connections').select('mutual_ids').in_('x_user_id', batch_ids).execute()
            if second_response.data:
                for conn in second_response.data:
                    second_degree_ids.update(conn.get('mutual_ids', []) or [])
        
        second_degree_ids.discard(user_id)
        second_degree_ids -= set(first_degree_ids)
        
        all_profile_ids = list(set(first_degree_ids) | second_degree_ids)
        
        # Clear existing embeddings to force regeneration
        if request.force:
            print(f"🗑️ Clearing existing embeddings for {len(all_profile_ids)} profiles...")
            for i in range(0, len(all_profile_ids), BATCH_SIZE):
                batch_ids = all_profile_ids[i:i+BATCH_SIZE]
                supabase.table('x_profiles').update({
                    'summary': None,
                    'embedding': None
                }).in_('x_user_id', batch_ids).execute()
        
        # Now call the regular generate endpoint
        return await generate_rag(RAGGenerateRequest(x_user_id=user_id))
        
    except Exception as e:
        print(f"RAG regeneration error: {e}")
        raise HTTPException(status_code=500, detail=f"RAG regeneration failed: {str(e)}")


@router.get("/status")
async def get_rag_status():
    """Check how many profiles have summaries and embeddings"""
    try:
        supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not supabase_url or not supabase_key:
            raise HTTPException(status_code=500, detail="Supabase credentials not configured")
        
        supabase: Client = create_client(supabase_url, supabase_key)
        
        # Count total profiles
        total_response = supabase.table('x_profiles').select('x_user_id', count='exact').execute()
        total = total_response.count
        
        # Count profiles with summaries
        with_summary_response = supabase.table('x_profiles').select('x_user_id', count='exact').not_.is_('summary', None).execute()
        with_summary = with_summary_response.count
        
        # Count profiles with posts
        posts_response = supabase.table('x_posts').select('x_user_id', count='exact').execute()
        with_posts = posts_response.count
        
        need_processing = total - with_summary
        progress = (with_summary / total * 100) if total > 0 else 0
        
        return {
            "total_profiles": total,
            "profiles_with_summary": with_summary,
            "profiles_with_posts": with_posts,
            "profiles_needing_processing": need_processing,
            "progress_percentage": round(progress, 1)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")

