import uuid
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.vision import Vision
from app.schemas.vision import VisionCreate, VisionUpdate


async def get_vision(
    db: AsyncSession, vision_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Vision]:
    result = await db.execute(
        select(Vision).where(
            and_(Vision.id == vision_id, Vision.user_id == user_id)
        )
    )
    return result.scalar_one_or_none()


async def get_vision_with_goals(
    db: AsyncSession, vision_id: uuid.UUID, user_id: uuid.UUID
) -> Optional[Vision]:
    result = await db.execute(
        select(Vision)
        .options(selectinload(Vision.goals))
        .where(and_(Vision.id == vision_id, Vision.user_id == user_id))
    )
    return result.scalar_one_or_none()


async def get_visions(
    db: AsyncSession,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    include_archived: bool = False,
) -> List[Vision]:
    query = select(Vision).where(Vision.user_id == user_id)
    if not include_archived:
        query = query.where(Vision.is_archived.is_(False))
    query = query.order_by(Vision.sort_order, Vision.created_at.desc())
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def create_vision(
    db: AsyncSession, user_id: uuid.UUID, vision_in: VisionCreate
) -> Vision:
    vision = Vision(
        user_id=user_id,
        **vision_in.model_dump()
    )
    db.add(vision)
    await db.commit()
    await db.refresh(vision)
    return vision


async def update_vision(
    db: AsyncSession, vision: Vision, vision_in: VisionUpdate
) -> Vision:
    update_data = vision_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(vision, field, value)
    await db.commit()
    await db.refresh(vision)
    return vision


async def delete_vision(db: AsyncSession, vision: Vision) -> None:
    await db.delete(vision)
    await db.commit()
