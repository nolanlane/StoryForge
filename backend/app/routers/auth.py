from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.db import get_db
from app.models import User
from app.schemas import LoginRequest, SignupRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

def _validate_password(password: str) -> None:
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(status_code=422, detail="Password too long (max 72 bytes)")

@router.post("/signup", response_model=TokenResponse)
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).filter(User.email == req.email.lower()))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    _validate_password(req.password)

    try:
        pw_hash = hash_password(req.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    user = User(email=req.email.lower(), password_hash=pw_hash)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(user.email)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).filter(User.email == req.email.lower()))
    user = result.scalars().first()

    _validate_password(req.password)

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    try:
        ok = verify_password(req.password, user.password_hash)
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user_email = user.email
    token = create_access_token(user_email)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(email=current_user.email)
