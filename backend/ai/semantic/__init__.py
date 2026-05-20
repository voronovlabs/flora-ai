"""Semantic layer over the analytics datamart.

Empty placeholder. Target shape::

    Entity("Bouquet", table="dm.comp_daily_prices",
           dimensions=[Dimension("source"), Dimension("d", kind="date")],
           measures=[Measure("price"), Measure("sku_count", agg="count")])

Once defined here, the LLM prompts can reason about *entities*
(Bouquet, Competitor, Category) instead of SQL identifiers. That's the
unlock for natural-language analytics that doesn't break every time a
column gets renamed.
"""
