"""Cross-cutting middleware: request id, request timing.

Adds a context-local ``request_id`` so any log line inside the request
handler chain can correlate. Returns ``X-Request-ID`` and
``X-Response-Time-ms`` headers when the relevant feature flag is on.
"""

from __future__ import annotations

import contextvars
import time
import uuid
from typing import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.core.config import get_settings
from backend.core.logging import get_logger


_request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default="-"
)


def current_request_id() -> str:
    return _request_id_ctx.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Generate / propagate ``X-Request-ID`` per request."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        rid = (
            request.headers.get("x-request-id")
            or uuid.uuid4().hex[:16]
        )
        token = _request_id_ctx.set(rid)
        try:
            response = await call_next(request)
        finally:
            _request_id_ctx.reset(token)
        if get_settings().flags.enable_request_id_header:
            response.headers["X-Request-ID"] = rid
        return response


class TimingMiddleware(BaseHTTPMiddleware):
    """Measure handler wall-clock and log it."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        log = get_logger("flora.http")
        t0 = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        try:
            response.headers["X-Response-Time-ms"] = f"{elapsed_ms:.1f}"
        except Exception:
            pass
        log.info(
            "request",
            extra={
                "method": request.method,
                "path":   request.url.path,
                "status": getattr(response, "status_code", 0),
                "ms":     round(elapsed_ms, 1),
                "rid":    current_request_id(),
            },
        )
        return response
