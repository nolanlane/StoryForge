from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STORYFORGE_", case_sensitive=False)

    gemini_api_key: str
    # Defaults aim for price-performance with a higher-quality fallback.
    gemini_text_model: str = "gemini-2.5-flash"
    gemini_text_fallback_model: str = "gemini-2.5-pro"
    gemini_text_timeout_s: float = 180.0
    imagen_model: str = "gemini-2.5-flash-image"
    imagen_timeout_s: float = 45.0
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 60 * 24 * 7

    db_url: str = "sqlite+aiosqlite:////data/storyforge.db"

    cors_origins: str = "*"


settings = Settings()
