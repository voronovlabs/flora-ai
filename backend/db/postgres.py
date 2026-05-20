"""Thin synchronous Postgres helper.

Mirrors the legacy `run_sql_text` helper exactly: short-lived connection,
RealDictCursor, optional params, fetchmany(limit).
"""

from __future__ import annotations

from typing import Any, Iterable, List, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

from backend.config import (
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_PORT,
    DB_USER,
)


def run_sql_text(
    sql_text: str,
    params: Optional[Iterable[Any]] = None,
    limit: int = 50,
) -> List[dict]:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        dbname=DB_NAME,
        connect_timeout=5,
    )
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(sql_text, params or ())
            if cur.description is None:
                return []
            rows = cur.fetchmany(limit)
            return [dict(r) for r in rows]
    finally:
        conn.close()
