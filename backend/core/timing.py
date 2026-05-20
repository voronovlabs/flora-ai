"""Tiny timing helpers used in /smart and the DB layer.

Designed for ad-hoc instrumentation; if/when you wire OpenTelemetry,
this file becomes the only thing to replace.
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from typing import Iterator

from backend.core.logging import get_logger
from backend.core.middleware import current_request_id


@contextmanager
def timed(scope: str, **extra) -> Iterator[dict]:
    """Yields a dict that is filled with elapsed_ms on exit.

    Usage::

        with timed("db.fetchmany", table="dm.comp_daily_prices") as t:
            rows = run_sql_text(...)
        # t["elapsed_ms"] is available here
    """
    log = get_logger("flora.timing")
    info: dict = {}
    t0 = time.perf_counter()
    try:
        yield info
    finally:
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        info["elapsed_ms"] = round(elapsed_ms, 2)
        log.info("timed", extra={"scope": scope, "ms": info["elapsed_ms"], "rid": current_request_id(), **extra})
