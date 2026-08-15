# Design

`ensure_ready` 抽出给 `open_own_store` / `checkpoint_own_store` 共用。checkpoint 仍走 DiskStorage，retainPrevious=2。
