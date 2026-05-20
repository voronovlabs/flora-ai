"""Structured-ish logging without an extra dependency.

We log JSON-flavored key=value pairs so they're greppable in plain
``docker compose logs`` and parsable in Loki / Datadog if you wire one
up later. ``structlog`` would be nicer but isn't strictly necessary
for this stage; if you adopt it, swap ``configure_logging`` and the
existing call-sites keep working.
"""

from __future__ import annotations

import logging
import os
import sys
from typing import Any


class _KVFormatter(logging.Formatter):
    """``2026-05-21T10:11:12Z level=INFO logger=flora.api msg='...' k=v``."""

    def format(self, record: logging.LogRecord) -> str:
        base = {
            "ts":     self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level":  record.levelname,
            "logger": record.name,
            "msg":    record.getMessage(),
        }
        # Drag any extra=... fields through.
        for k, v in record.__dict__.items():
            if k in (
                "args", "asctime", "created", "exc_info", "exc_text", "filename",
                "funcName", "levelname", "levelno", "lineno", "message", "module",
                "msecs", "msg", "name", "pathname", "process", "processName",
                "relativeCreated", "stack_info", "thread", "threadName",
            ):
                continue
            base[k] = v
        if record.exc_info:
            base["exc"] = self.formatException(record.exc_info)
        return _format_kv(base)


def _format_kv(d: dict[str, Any]) -> str:
    parts = []
    for k, v in d.items():
        s = str(v)
        if " " in s or "=" in s:
            s = "'" + s.replace("'", "\\'") + "'"
        parts.append(f"{k}={s}")
    return " ".join(parts)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    root.handlers.clear()
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(_KVFormatter())
    root.addHandler(h)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Tame noisy third-parties; keep our loggers verbose-enough.
    logging.getLogger("uvicorn.access").setLevel(
        logging.INFO if os.getenv("UVICORN_ACCESS_LOG", "1") == "1" else logging.WARNING
    )


def get_logger(name: str = "flora") -> logging.Logger:
    return logging.getLogger(name)
