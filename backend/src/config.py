"""Configuration loaded from environment variables / .env file."""

from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="TANGLED_ORG_",
        case_sensitive=False,
    )

    # ATProto / PDS
    pds_host: str = "https://tngl.sh"
    handle: str = ""
    app_password: str = ""

    # Anthropic (for agent, optional at this stage)
    anthropic_api_key: Optional[str] = None

    # AppView
    port: int = 8080
    db_path: str = "./data/tangledorg.db"
    jetstream_url: str = "wss://jetstream2.us-east.bsky.network/subscribe"

    # Debug
    debug: bool = False


settings = Settings()
