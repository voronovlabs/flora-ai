"""Brand-enrichment service.

Подмешивает в API-ответы поля ``brand_name`` и ``site_url`` на основе
``ref.shop_directory``. Никаких эвристик / парсинга / угадываний —
только справочник. Если для домена нет записи в справочнике,
``brand_name`` и ``site_url`` будут ``None`` — frontend в этом случае
показывает домен как раньше.

Источник: ``backend.repositories.shop_directory.ShopDirectoryRepository``.
Этот модуль — тонкая обвязка: один lookup + один pass по списку строк.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional

from backend.repositories.shop_directory import ShopBrand, ShopDirectoryRepository


# Алиасы домена (исторические source-значения из dm.comp_daily_prices,
# где парсер записал короткий идентификатор вместо полного домена).
# Эти ключи матчатся к шопу из ref.shop_directory.
# Мы НЕ переименовываем source — только знаем, как его сматчить с
# директорией.
SOURCE_ALIASES: Dict[str, str] = {
    "florist":     "florist.ru",
    "florist_ru":  "florist.ru",
    "flowwow":     "flowwow.com",
    "semicvetic":  "semicvetic.com",
    "semicvetik":  "semicvetic.com",
    "семицветик": "semicvetic.com",
    "azalia":      "azalianow.ru",
    "azalianow":   "azalianow.ru",
    "азалия":     "azalianow.ru",
    "dostavkatsvetov":    "dostavkatsvetov.ru",
}


def _normalize_lookup_key(source: Optional[str]) -> Optional[str]:
    if source is None:
        return None
    s = str(source).strip().lower()
    if not s:
        return None
    if s in SOURCE_ALIASES:
        return SOURCE_ALIASES[s]
    return s


def lookup(source: Optional[str], repo: Optional[ShopDirectoryRepository] = None) -> Optional[ShopBrand]:
    """Возвращает ShopBrand для домена/алиаса или ``None``."""
    key = _normalize_lookup_key(source)
    if not key:
        return None
    repo = repo or ShopDirectoryRepository()
    directory = repo.load_all()
    return directory.get(key)


def enrich_row(
    row: Dict[str, Any],
    repo: Optional[ShopDirectoryRepository] = None,
    source_key: str = "source",
) -> Dict[str, Any]:
    """Возвращает копию строки с добавленными ``brand_name`` и ``site_url``.

    Поле ``source`` сохраняется как есть. Если домен отсутствует в
    справочнике, поля будут ``None`` — frontend сам fallback'ается.
    """
    if not isinstance(row, dict):
        return row
    brand = lookup(row.get(source_key), repo=repo)
    out = dict(row)
    out["brand_name"] = brand.brand_name if brand else None
    out["site_url"] = brand.site_url if brand else None
    return out


def enrich_rows(
    rows: Iterable[Dict[str, Any]],
    repo: Optional[ShopDirectoryRepository] = None,
    source_key: str = "source",
) -> List[Dict[str, Any]]:
    """Батч-обогащение списка строк. Один lookup_all → много матчей."""
    repo = repo or ShopDirectoryRepository()
    # Forсируем загрузку директории один раз (кэш в репозитории).
    repo.load_all()
    return [enrich_row(r, repo=repo, source_key=source_key) for r in rows]


def display_name(source: Optional[str], repo: Optional[ShopDirectoryRepository] = None) -> str:
    """Удобный helper для inline-текста: brand_name || source || '—'."""
    if source is None:
        return "—"
    brand = lookup(source, repo=repo)
    return brand.brand_name if brand else str(source)
