# Design

先合法 migrate 1→2，再用 `reader_schema=1` 尝试 2→3。`migrate_own_store` 必须返回 `quarantine`。
