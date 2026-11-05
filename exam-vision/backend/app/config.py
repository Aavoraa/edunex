# backend/app/config.py
"""Runtime paths and process-level settings.

AI provider settings (URLs, models, API keys) are NOT here: administrators set them in
Settings -> AI Configuration and they are stored in the database (keys encrypted).
"""

import os
import time
from dataclasses import dataclass, field
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(BASE_DIR / ".env")

# On Vercel the service runs as functions: the disk is read-only apart from /tmp (and is wiped
# between requests), and work stops once a request has been answered.
ON_VERCEL = bool(os.getenv("VERCEL"))


def _database_url() -> str:
    """PostgreSQL when configured (EXAM_DATABASE_URL, or on Vercel the project's DATABASE_URL); else SQLite."""
    url = os.getenv("EXAM_DATABASE_URL") or (
        (os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL", "")) if ON_VERCEL else "")
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


@dataclass
class Settings:
    data_dir: Path = field(default_factory=lambda: Path(os.getenv("EXAM_DATA_DIR") or ("/tmp/exam-vision" if ON_VERCEL else BASE_DIR / "data")))
    # "" = SQLite in the data folder. With PostgreSQL the tables live in their own schema.
    database_url: str = field(default_factory=_database_url)
    db_schema: str = os.getenv("EXAM_DB_SCHEMA", "exam_vision")
    port: int = int(os.getenv("EXAM_PORT", "8006"))
    max_upload_bytes: int = int(os.getenv("EXAM_MAX_UPLOAD", 40 * 1024 * 1024))
    max_pages: int = int(os.getenv("EXAM_MAX_PAGES", "40"))
    session_hours: int = int(os.getenv("EXAM_SESSION_HOURS", "12"))
    workers: int = int(os.getenv("EXAM_WORKERS", "2"))
    # Background workers read and mark sheets. Off (inline, within the request) for tests and on Vercel.
    run_jobs: bool = os.getenv("EXAM_RUN_JOBS", "0" if ON_VERCEL else "1") == "1"
    # Shared with the Edunex API. When set, EXAM Vision runs as a module of Edunex: every request
    # must carry an identity signed by the Edunex API, and local sign-in is switched off.
    # EXAM_VISION_SECRET is the same value under the API's name (one shared variable on Vercel).
    gateway_secret: str = os.getenv("EXAM_GATEWAY_SECRET") or os.getenv("EXAM_VISION_SECRET", "")

    @property
    def integrated(self) -> bool:
        return bool(self.gateway_secret)

    @property
    def db_path(self) -> Path:
        return self.data_dir / "exam.db"

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "sheets"

    @property
    def secret_key_path(self) -> Path:
        return self.data_dir / "secret.key"


settings = Settings()
# Lets the Edunex API notice a restart and send the roster again.
STARTED_AT = int(time.time())


def ensure_dirs(s: Settings = settings) -> None:
    s.data_dir.mkdir(parents=True, exist_ok=True)
    s.upload_dir.mkdir(parents=True, exist_ok=True)
