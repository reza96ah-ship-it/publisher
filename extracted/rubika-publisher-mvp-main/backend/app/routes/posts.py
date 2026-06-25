from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Post, Store, User
from app.schemas import PostRequest, PostResponse

router = APIRouter(prefix="/posts", tags=["posts"])


def active_store(db: Session) -> Store:
    store = db.scalar(select(Store).where(Store.is_active.is_(True)).order_by(Store.id.asc()))
    if store is None:
        raise HTTPException(status_code=400, detail="Create store profile first")
    return store


def post_response(post: Post) -> PostResponse:
    return PostResponse(
        id=post.id,
        store_id=post.store_id,
        title=post.title,
        caption=post.caption,
        hashtags=post.hashtags,
        platform=post.platform,
        status=post.status,
    )


@router.get("")
def list_posts(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    posts = db.scalars(select(Post).where(Post.store_id == store.id).order_by(Post.id.desc())).all()
    return [post_response(post) for post in posts]


@router.post("")
def create_post(payload: PostRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    title = payload.title.strip() or "پست بدون عنوان"
    post = Post(
        store_id=store.id,
        title=title,
        caption=payload.caption.strip(),
        hashtags=payload.hashtags.strip(),
        platform=payload.platform.strip() or "rubika",
        status="draft",
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.put("/{post_id}")
def update_post(post_id: int, payload: PostRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    post = db.scalar(select(Post).where(Post.id == post_id, Post.store_id == store.id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft posts can be edited")

    post.title = payload.title.strip() or "پست بدون عنوان"
    post.caption = payload.caption.strip()
    post.hashtags = payload.hashtags.strip()
    post.platform = payload.platform.strip() or "rubika"
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return post_response(post)


@router.delete("/{post_id}")
def delete_post(post_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    store = active_store(db)
    post = db.scalar(select(Post).where(Post.id == post_id, Post.store_id == store.id))
    if post is None:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.status != "draft":
        raise HTTPException(status_code=400, detail="Only draft posts can be deleted")

    db.delete(post)
    db.commit()
    return {"ok": True}
