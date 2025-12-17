from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STORYFORGE_", case_sensitive=False)

    gemini_api_key: str
    gemini_text_model: str = "gemini-2.5-flash"
    gemini_text_fallback_model: str = "gemini-2.5-flash"
    gemini_text_timeout_s: float = 180.0
    imagen_model: str = "imagen-4.0-generate-001"
    imagen_timeout_s: float = 45.0
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 60 * 24 * 7

    db_url: str = "sqlite:////data/storyforge.db"

    cors_origins: str = "*"


settings = Settings()
