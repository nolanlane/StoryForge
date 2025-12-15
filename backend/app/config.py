from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="STORYFORGE_", case_sensitive=False)

    gemini_api_key: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 60 * 24 * 7

    db_url: str = "sqlite:////data/storyforge.db"

    cors_origins: str = "*"


settings = Settings()
