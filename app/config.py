import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:Leonigleo1024%40%2B@127.0.0.1:5432/vkr"
    ).strip()


settings = Settings()
print("DATABASE_URL =", repr(settings.DATABASE_URL))