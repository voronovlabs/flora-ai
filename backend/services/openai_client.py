"""Tiny wrapper around the OpenAI Responses API.

Uses urllib so we don't pull in the `openai` SDK as a dependency. Matches
the legacy implementation exactly to preserve behavior.
"""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.config import OPENAI_API_KEY, OPENAI_MODEL, SMART_REQUEST_TIMEOUT


def openai_responses_json(instructions: str, user_input: str) -> str:
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set")

    url = "https://api.openai.com/v1/responses"
    payload = {
        "model": OPENAI_MODEL,
        "instructions": instructions,
        "input": user_input,
        "temperature": 0,
        "max_output_tokens": 700,
        "text": {"format": {"type": "text"}},
    }

    req = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(req, timeout=SMART_REQUEST_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        raise RuntimeError(f"OpenAI HTTPError {e.code}: {body[:500]}")
    except URLError as e:
        raise RuntimeError(f"OpenAI URLError: {e}")
    except Exception as e:
        raise RuntimeError(f"OpenAI error: {e}")

    j = json.loads(raw)

    out = j.get("output") or []
    for item in out:
        if item.get("type") == "message" and item.get("role") == "assistant":
            content = item.get("content") or []
            texts = []
            for c in content:
                if c.get("type") == "output_text" and isinstance(c.get("text"), str):
                    texts.append(c["text"])
            if texts:
                return "\n".join(texts).strip()

    return ""
