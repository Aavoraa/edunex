# backend/app/db.py
"""Engine, sessions and schema migrations (SQLite in the data folder)."""

from __future__ import annotations

from collections.abc import Callable, Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import Settings, ensure_dirs, settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_SessionLocal: sessionmaker | None = None


def _sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA foreign_keys=ON")
    cur.execute("PRAGMA journal_mode=WAL")
    cur.close()


def configure(s: Settings = settings) -> Engine:
    """(Re)create the engine for ``s`` and apply migrations."""
    global _engine, _SessionLocal
    ensure_dirs(s)
    if _engine is not None:
        _engine.dispose()  # reconfiguring (tests): release the old pool's connections
    _engine = create_engine(f"sqlite:///{s.db_path}", connect_args={"check_same_thread": False, "timeout": 30})
    event.listen(_engine, "connect", _sqlite_pragmas)
    _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    migrate(_engine)
    return _engine


def engine() -> Engine:
    if _engine is None:
        configure()
    return _engine  # type: ignore[return-value]


def new_session() -> Session:
    if _SessionLocal is None:
        configure()
    return _SessionLocal()  # type: ignore[misc]


def get_db() -> Iterator[Session]:
    db = new_session()
    try:
        yield db
    finally:
        db.close()


# --- migrations --------------------------------------------------------------
# Each entry upgrades the schema by one version. Never edit an applied migration:
# append a new one. Version 1 creates every table from the models.

def _v1(conn) -> None:
    from . import models  # noqa: F401  (registers the tables)

    Base.metadata.create_all(conn)


def _v2(conn) -> None:
    # who wrote a rubric version: "teacher" or "ai_draft"
    cols = [r[1] for r in conn.execute(text("PRAGMA table_info(rubric_versions)"))]
    if "source" not in cols:
        conn.execute(text("ALTER TABLE rubric_versions ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'teacher'"))


def _v3(conn) -> None:
    # page images in the database, next to the records that refer to them
    from .models import PageImage

    PageImage.__table__.create(conn, checkfirst=True)


def _v4(conn) -> None:
    # at most one queued or running job per sheet: two at once read and marked it twice
    jobs = "jobs"
    active = "status IN ('queued', 'running')"
    conn.execute(text(f"UPDATE {jobs} SET status = 'failed', error = 'duplicate job' WHERE {active} AND id NOT IN "
                      f"(SELECT MIN(id) FROM {jobs} WHERE {active} GROUP BY submission_id)"))
    conn.execute(text(f"CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_one_active ON {jobs} (submission_id) WHERE {active}"))


MIGRATIONS: list[Callable] = [_v1, _v2, _v3, _v4]


def migrate(eng: Engine) -> int:
    with eng.begin() as conn:
        table = "schema_version"
        conn.execute(text(f"CREATE TABLE IF NOT EXISTS {table} (version INTEGER NOT NULL)"))
        row = conn.execute(text(f"SELECT version FROM {table}")).fetchone()
        current = row[0] if row else 0
        for number, step in enumerate(MIGRATIONS, start=1):
            if number > current:
                step(conn)
        if row is None:
            conn.execute(text(f"INSERT INTO {table} (version) VALUES (:v)"), {"v": len(MIGRATIONS)})
        elif current < len(MIGRATIONS):
            conn.execute(text(f"UPDATE {table} SET version = :v"), {"v": len(MIGRATIONS)})
    return len(MIGRATIONS)
