from fastapi import APIRouter
from typing import List

router = APIRouter(tags=["items"])


@router.get("/items")
async def get_items():
    return {"items": ["item1", "item2", "item3"]}


@router.get("/items/{item_id}")
async def get_item(item_id: int):
    return {"item_id": item_id, "name": f"Item {item_id}"}
