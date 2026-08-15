# Design

`restore_own_store` 已转发 `DiskStorage::restore`。本刀补组合面回归：activate + open store，不 checkpoint，直接 restore 必须失败。
