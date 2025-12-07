"""
Embeddings routes for RAG/vector search functionality.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional
from pydantic import BaseModel

from nexus.utils import get_db
from nexus.db.schema import XProfile
from nexus.services.embeddings import EmbeddingsService

router = APIRouter(tags=["embeddings"])


class EmbeddingGenerateRequest(BaseModel):
    batch_size: Optional[int] = 50
    x_user_ids: Optional[list[str]] = None


@router.post("/generate")
async def generate_embeddings(
    request: EmbeddingGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate embeddings for profiles without embeddings.
    Can optionally specify specific user IDs or process all profiles without embeddings.
    """
    try:
        embeddings_service = EmbeddingsService()
        
        result = await embeddings_service.generate_embeddings_for_profiles(
            db=db,
            x_user_ids=request.x_user_ids,
            batch_size=request.batch_size
        )
        
        return {
            "success": True,
            **result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Embedding generation failed: {str(e)}"
        )


@router.post("/generate-all")
async def generate_all_embeddings(
    batch_size: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate embeddings for ALL profiles without embeddings in the database.
    Processes in batches until all profiles have embeddings.
    """
    try:
        embeddings_service = EmbeddingsService()
        
        result = await embeddings_service.generate_embeddings_for_all_profiles(
            db=db,
            batch_size=batch_size
        )
        
        return {
            "success": True,
            **result
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Embedding generation failed: {str(e)}"
        )


@router.get("/status")
async def get_embeddings_status(db: AsyncSession = Depends(get_db)):
    """
    Get the current status of embeddings in the database.
    Shows how many profiles have embeddings vs how many need them.
    """
    try:
        # Count total profiles
        total_result = await db.execute(
            select(func.count()).select_from(XProfile)
        )
        total_count = total_result.scalar()
        
        # Count profiles with embeddings
        embedded_result = await db.execute(
            select(func.count()).select_from(XProfile).where(
                XProfile.embedding.isnot(None)
            )
        )
        embedded_count = embedded_result.scalar()
        
        # Calculate profiles needing embeddings
        need_embedding = total_count - embedded_count
        progress_pct = (embedded_count / total_count * 100) if total_count > 0 else 0
        
        return {
            "total_profiles": total_count,
            "profiles_with_embeddings": embedded_count,
            "profiles_needing_embeddings": need_embedding,
            "progress_percentage": round(progress_pct, 1),
            "status": "complete" if need_embedding == 0 else "incomplete"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get status: {str(e)}"
        )


@router.post("/regenerate/{x_user_id}")
async def regenerate_embedding(
    x_user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Regenerate embedding for a specific profile.
    Useful for updating embeddings after profile changes.
    """
    try:
        # Get the profile
        result = await db.execute(
            select(XProfile).where(XProfile.x_user_id == x_user_id)
        )
        profile = result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
        
        # Generate new embedding
        embeddings_service = EmbeddingsService()
        profile_text = embeddings_service.create_profile_text(profile)
        embedding = embeddings_service.generate_embedding(profile_text)
        
        # Update profile
        profile.embedding = embedding
        await db.commit()
        
        return {
            "success": True,
            "message": f"Regenerated embedding for @{profile.username}",
            "x_user_id": x_user_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to regenerate embedding: {str(e)}"
        )

