"""SQL safety net for the /smart pipeline.

We never let the LLM emit raw SQL — it returns intent JSON which we
translate via services/intent.py. This module still applies a final
belt-and-suspenders validation in case a future code path generates SQL
that touches user-influenced strings.
"""

from __future__ import annotations

import re
from typing import List, Tuple

from backend.config import ALLOWED_TABLES, SMART_DEFAULT_LIMIT


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
    found = []
    for m in FROM_JOIN_RE.finditer(sql_text):
        a = m.group(2)
        b = m.group(3)
        full = f"{a}.{b}" if b else f"public.{a}"
        found.append(full.lower())
    seen = set()
    out = []
    for t in found:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out


def enforce_limit(sql_text: str, max_rows: int) -> str:
    s = sql_text
    m = LIMIT_RE.search(s)
    if not m:
        return f"{s}\nLIMIT {min(SMART_DEFAULT_LIMIT, max_rows)}"
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

    tables = extract_tables(s)
    for t in tables:
        if t not in ALLOWED_TABLES:
            return False, f"Таблица не разрешена: {t}. Разрешены: {sorted(ALLOWED_TABLES)}"

    return True, ""
