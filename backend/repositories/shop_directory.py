"""Repository for ``ref.shop_directory`` — справочник магазинов.

Источник истины для отображения брендов: домен → название бренда + URL
официального сайта. Используется backend-сервисом ``branding`` для
обогащения исходящих API-ответов полями ``brand_name`` и ``site_url``.

Никаких эвристик / LLM / парсинга title — только то, что лежит в
``ref.shop_directory``. Если для домена записи нет — клиент показывает
домен как раньше (frontend fallback).

Справочник меняется редко (вручную, по мере добавления магазинов в
мониторинг), поэтому ответ кешируется в памяти процесса с мягким TTL.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock
from typing import Dict, Optional

from backend.core.timing import timed
from backend.db.postgres import run_sql_text


# Один SELECT — единственное место, где обращаемся к таблице.
SQL_LOAD_DIRECTORY = """
select
  lower(domain) as domain,
  brand_name,
  site_url
from ref.shop_directory
where is_active is true or is_active is null
""".strip()


# TTL кэша. Справочник меняется руками — 10 минут более чем достаточно,
# чтобы переживать deploy / hot-edit без рестарта API.
CACHE_TTL_SEC = 600


@dataclass(frozen=True)
class ShopBrand:
    """Маппинг одного домена."""
    domain: str
    brand_name: str
    site_url: Optional[str]


class ShopDirectoryRepository:
    """All reads against ``ref.shop_directory``."""

    TABLE = "ref.shop_directory"

    _cache: Optional[Dict[str, ShopBrand]] = None
    _cache_expires_at: float = 0.0
    _lock = Lock()

    def load_all(self) -> Dict[str, ShopBrand]:
        """Возвращает {domain → ShopBrand}. Кэшируется в памяти процесса.

        При ошибке БД возвращает пустой словарь — продукт продолжает
        работать с fallback'ом на домены.
        """
        now = time.time()
        if (
            ShopDirectoryRepository._cache is not None
            and now < ShopDirectoryRepository._cache_expires_at
        ):
            return ShopDirectoryRepository._cache

        with ShopDirectoryRepository._lock:
            # Double-check внутри лока на случай параллельных запросов.
            if (
                ShopDirectoryRepository._cache is not None
                and now < ShopDirectoryRepository._cache_expires_at
            ):
                return ShopDirectoryRepository._cache

            try:
                with timed("repo.shop_directory.load_all"):
                    rows = run_sql_text(SQL_LOAD_DIRECTORY, limit=1000) or []
            except Exception:
                # Деградируем мягко: возвращаем уже закэшированный (даже
                # просроченный) словарь или пустой — fallback на домены
                # на frontend сработает автоматически.
                return ShopDirectoryRepository._cache or {}

            mapping: Dict[str, ShopBrand] = {}
            for r in rows:
                d = r.get("domain")
                b = r.get("brand_name")
                if not d or not b:
                    continue
                mapping[str(d).lower().strip()] = ShopBrand(
                    domain=str(d).lower().strip(),
                    brand_name=str(b).strip(),
                    site_url=(str(r.get("site_url")).strip() if r.get("site_url") else None),
                )

            ShopDirectoryRepository._cache = mapping
            ShopDirectoryRepository._cache_expires_at = now + CACHE_TTL_SEC
            return mapping

    def invalidate(self) -> None:
        """Сбросить кэш — для тестов или ручного refresh'а."""
        with ShopDirectoryRepository._lock:
            ShopDirectoryRepository._cache = None
            ShopDirectoryRepository._cache_expires_at = 0.0
