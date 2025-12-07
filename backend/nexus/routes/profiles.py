"""
Profile data retrieval routes.
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from nexus.utils import get_db
from nexus.db.schema import XProfile
from nexus.models import XProfileResponse

router = APIRouter(tags=["profiles"])


@router.get("/profiles/{x_user_id}/get", response_model=XProfileResponse)
async def get_profile(x_user_id: str, db: AsyncSession = Depends(get_db)):
    """Get a profile from our database"""
    result = await db.execute(
        select(XProfile).where(XProfile.x_user_id == x_user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return profile


@router.get("/profiles/list", response_model=List[XProfileResponse])
async def list_profiles(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """List all profiles in database"""
    result = await db.execute(
        select(XProfile).limit(limit).offset(offset)
    )
    return result.scalars().all()
