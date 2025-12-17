from datetime import datetime
import json
from pydantic import BaseModel, EmailStr, Field
from pydantic import field_validator


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
    systemPrompt: str = Field(max_length=20000)
    userPrompt: str = Field(max_length=20000)
    jsonMode: bool = False
    timeoutMs: int | None = Field(default=None, ge=1000, le=300000)
    generationConfig: dict | None = None


class AiTextResponse(BaseModel):
    text: str


class AiImagenRequest(BaseModel):
    prompt: str = Field(max_length=8000)
    timeoutMs: int | None = Field(default=None, ge=1000, le=60000)


class AiImagenResponse(BaseModel):
    dataUrl: str | None = None


class AiSequelRequest(BaseModel):
    sourceBlueprint: dict
    endingExcerpt: str = Field(default="", max_length=2500)
    chapterCount: int = Field(ge=1, le=50)
    bannedDescriptorTokens: list[str] = Field(default_factory=list, max_length=200)
    bannedPhrases: list[str] = Field(default_factory=list, max_length=200)

    @field_validator("sourceBlueprint")
    @classmethod
    def _limit_source_blueprint_size(cls, v: dict) -> dict:
        try:
            raw = json.dumps(v, ensure_ascii=False)
        except (TypeError, ValueError):
            raise ValueError("sourceBlueprint must be JSON-serializable")

        if len(raw.encode("utf-8")) > 200_000:
            raise ValueError("sourceBlueprint too large")

        return v


class AiSequelResponse(BaseModel):
    blueprint: dict
