from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=72)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    email: EmailStr


class StoryUpsert(BaseModel):
    id: str
    title: str = ""
    genre: str = ""
    tone: str = ""
    config: dict = Field(default_factory=dict)
    blueprint: dict = Field(default_factory=dict)
    storyContent: dict = Field(default_factory=dict)
    storyImages: dict = Field(default_factory=dict)
    sequelOfId: str | None = None


class StorySummary(BaseModel):
    id: str
    title: str
    genre: str
    tone: str
    createdAt: datetime
    updatedAt: datetime
    sequelOfId: str | None = None


class StoryDetail(StorySummary):
    config: dict
    blueprint: dict
    storyContent: dict
    storyImages: dict


class AiTextRequest(BaseModel):
    systemPrompt: str
    userPrompt: str
    jsonMode: bool = False
    timeoutMs: int | None = None
    generationConfig: dict | None = None


class AiTextResponse(BaseModel):
    text: str


class AiImagenRequest(BaseModel):
    prompt: str
    timeoutMs: int | None = None


class AiImagenResponse(BaseModel):
    dataUrl: str | None = None


class AiSequelRequest(BaseModel):
    sourceBlueprint: dict
    endingExcerpt: str = ""
    chapterCount: int
    bannedDescriptorTokens: list[str] = Field(default_factory=list)
    bannedPhrases: list[str] = Field(default_factory=list)


class AiSequelResponse(BaseModel):
    blueprint: dict
