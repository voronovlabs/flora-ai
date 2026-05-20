"""OpenAI Responses provider.

Wraps the same HTTP call the legacy ``_openai_responses_json`` helper
used. ``services/openai_client`` re-exports its public function for
backward compatibility.
"""

from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from backend.ai.providers.base import ChatRequest, ChatResponse, LLMProvider
from backend.core.config import get_settings


class OpenAIResponsesProvider(LLMProvider):
    name = "openai"

    def __init__(self, *, api_key: str | None = None, model: str | None = None, timeout_s: float | None = None) -> None:
        s = get_settings()
        self._api_key = (api_key if api_key is not None else s.ai.openai_api_key)
        self._model = model or s.ai.openai_model
        self._timeout = float(timeout_s if timeout_s is not None else s.smart.request_timeout_seconds)

    def chat(self, request: ChatRequest) -> ChatResponse:
        if not self._api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")

        url = "https://api.openai.com/v1/responses"
        payload = {
            "model": self._model,
            "instructions": request.instructions,
            "input": request.user_input,
            "temperature": request.temperature,
            "max_output_tokens": request.max_output_tokens,
            "text": {"format": {"type": "text"}},
        }

        req = Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=self._timeout) as resp:
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

        text_parts: list[str] = []
        for item in j.get("output") or []:
            if item.get("type") == "message" and item.get("role") == "assistant":
                for c in item.get("content") or []:
                    if c.get("type") == "output_text" and isinstance(c.get("text"), str):
                        text_parts.append(c["text"])
        text = "\n".join(text_parts).strip()
        return ChatResponse(text=text, model=self._model, raw=j)
