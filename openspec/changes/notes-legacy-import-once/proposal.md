# Proposal: notes-legacy-import-once

> OpenSpec change id: `notes-legacy-import-once`  
> Wave：P4.7 批次 25（第二根插头 · 存量一次性导入）  
> 依赖：`notes-dual-run-isolated-storage`  
> 架构：`15` §3 storage。flag-on 空库不是真插头。

## Why

flag-on 写隔离 sqlite，但用户已有 `note_card/**/*.json` 不会过去。本刀做一次性导入：扫描产品目录，按 id upsert 进隔离库。已存在的 id 不覆盖（隔离库优先）。不删源文件，不默认开 Notes flag，不 Slim。

## 目标与边界

1. `import_legacy_note_cards(source_dir, namespace)` MUST 导入 active + archive json。
2. 已存在 id MUST 跳过。
3. 源文件 MUST 保留。
4. **MUST NOT** 默认开 `MOSSX_NOTES_COMPAT_FACADE`，**MUST NOT** Slim。

## Capabilities

- `notes-legacy-import-once-v1`
