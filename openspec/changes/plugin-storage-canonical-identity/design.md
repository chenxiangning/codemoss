# Design

`StorageService::open_or_create` 使用与 Host 相同的 canonical 规则：`trim` 非空且 `value == value.trim()`。
