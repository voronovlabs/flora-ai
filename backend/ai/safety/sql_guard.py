"""SQL safety net for any pipeline that asks an LLM to influence SQL.

The current pipeline (``/smart``) doesn't let the model emit SQL at all
— it returns intent JSON which we translate deterministically. This
module exists so future paths that do generate SQL have an obvious,
already-existing wall to lean on.

API is unchanged from the legacy ``services.sql_safety`` module so the
shim there can re-export it.
"""

from __future__ import annotations

import re
from typing import List, Tuple

from backend.core.config import get_settings


DISALLOWED_SQL_RE = re.compile(
    r"""
    (;)|(--|/\*|\*/)|                              # multi statements / comments
    \b(insert|update|delete|drop|alter|create)\b|   # DDL/DML
    \b(grant|revoke|truncate|copy|vacuum|analyze)\b|
    \b(call|do|execute|prepare|deallocate)\b|
    \b(pg_sleep|pg_read_file|pg_write_file)\b|
    \b(information_schema|pg_catalog)\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

FROM_JOIN_RE = re.compile(
    r"""\b(from|join)\s+([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?""",
    re.IGNORECASE,
)

LIMIT_RE = re.compile(r"\blimit\s+(\d+)\b", re.IGNORECASE)


def normalize_sql(sql_text: str) -> str:
    s = (sql_text or "").strip()
    if s.endswith(";"):
        s = s[:-1].strip()
    return s


def extract_tables(sql_text: str) -> List[str]:
    found: list[str] = []
    for m in FROM_JOIN_RE.finditer(sql_text):
        a = m.group(2)
        b = m.group(3)
        full = f"{a}.{b}" if b else f"public.{a}"
        found.append(full.lower())
    seen: set[str] = set()
    out: list[str] = []
    for t in found:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def enforce_limit(sql_text: str, max_rows: int) -> str:
    s = sql_text
    m = LIMIT_RE.search(s)
    settings = get_settings()
    if not m:
        return f"{s}\nLIMIT {min(settings.smart.default_limit, max_rows)}"
    try:
        v = int(m.group(1))
    except Exception:
        v = max_rows
    if v > max_rows:
        s = LIMIT_RE.sub(f"LIMIT {max_rows}", s, count=1)
    return s


def validate_llm_sql(sql_text: str) -> Tuple[bool, str]:
    s = normalize_sql(sql_text)
    if not s:
        return False, "Пустой SQL"
    if not re.match(r"^\s*(select|with)\b", s, re.IGNORECASE):
        return False, "Разрешены только SELECT / WITH запросы"
    if DISALLOWED_SQL_RE.search(s):
        return False, "SQL содержит запрещённые конструкции"
    allowed = set(get_settings().allowed_tables)
    for t in extract_tables(s):
        if t not in allowed:
            return False, f"Таблица не разрешена: {t}. Разрешены: {sorted(allowed)}"
    return True, ""
