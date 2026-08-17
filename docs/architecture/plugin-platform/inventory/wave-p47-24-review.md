# Wave P4.7-24 / 25 Self-Review

> 日期：2026-08-16  
> 范围：产品默认 Process Entry + Notes 存量一次性导入  
> 结论：**方向正确。Claude 日常路径已是真插头。Notes 存量可进隔离库。Host 独立进程 / Slim 仍未做，不得宣称插排完成。**

## 做了

- `MOSSX_CLAUDE_PROCESS_ENTRY` 未设即 on；`0` 回 Core
- 制品根真实 CLI first-event / result 仍绿
- `import_legacy_once`：扫 json、跳过已有 id、写 sentinel、不删源
- flag-on `isolated_product()` 首次导入

## 没做（有意）

- 不 Slim、不删 `engine/claude*` / `note_cards`
- 不改 `boot_driver()`
- 不把 Host 做成独立进程
- 不默认开 Notes flag（避免未验证就切用户笔记）
