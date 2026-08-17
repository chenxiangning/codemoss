# notes-legacy-import-once-v1 Spec Delta

## ADDED Requirements

### Requirement: Isolated Notes MUST import existing Core json once

一次性导入 MUST 扫描产品 `note_card` 目录下 `active` / `archive` 的 `*.json`，写入隔离 sqlite。已存在的 note id MUST 跳过。源文件 MUST 保留。再次导入 MUST 不复制。`MOSSX_NOTES_COMPAT_FACADE` MUST 默认关。

#### Scenario: first import copies a legacy note

- **WHEN** 注入产品目录里有一条 `n-legacy.json`
- **THEN** import 后隔离 `get(n-legacy)` MUST 返回原 title
- **AND** 源文件 MUST 仍存在

#### Scenario: second import is a no-op

- **WHEN** 同一目录再 import 一次
- **THEN** 计数 MUST 不变
