# Design

`checkpoint_own_store` 转发 `checkpoint_own_store_retained(..., 2)`。后者走既有 DiskStorage retain 闸门。
