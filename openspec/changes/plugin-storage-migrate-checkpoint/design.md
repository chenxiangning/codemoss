# Design

`migrate_own_store` 已转发 `DiskStorage::migrate`。本刀只补组合面回归：activate + open store，不 checkpoint，直接 migrate 必须失败。
