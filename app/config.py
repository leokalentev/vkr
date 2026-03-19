import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:Leonigleo1024%40%2B@127.0.0.1:5432/vkr"
    ).strip()

    SECRET_KEY: str = os.getenv(
        "SECRET_KEY",
        "super_secret_key_for_diploma_project_12345"
    )

    ALGORITHM: str = os.getenv(
        "ALGORITHM",
        "HS256"
    )

    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60")
    )


settings = Settings()