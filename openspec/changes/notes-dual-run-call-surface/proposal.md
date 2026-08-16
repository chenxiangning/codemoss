# Proposal: notes-dual-run-call-surface

> OpenSpec change id: `notes-dual-run-call-surface`  
> Wave：4H（第二根插头 · 调用面 flag 收口）  
> 依赖：`notes-plugin-compat-adapter`（4E 单 owner 门面）、`notes-plugin-runtime-disable`（4G 组合面 disable）  
> 对标：`claude-dual-run-close`（Wave 3AN，「默认 off 调用面已齐」）  
> 架构：[`15` §3 step 5 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

Claude 的 dual-run 收口（3AN）已达成「默认 off 调用面已齐」：`ClaudeCompatAdapter` 是单 owner（`CompatOwner::CoreClaude`）的 delegate-to-Core 门面，`claude_owner()` 在 GUI / daemon / catalog / native 四处切换调用路径，flag `MOSSX_CLAUDE_COMPAT_FACADE` 默认 off——flag 切的是**调用路径**，不是第二个实现。

Notes（Wave 4）当前 4E 门面只有 `NotesBackend::list` + 内存 `MemoryNotesBackend`，**尚未 delegate-to-Core，也未在 `note_cards.rs` 的 7 条命令入口做调用路径 flag 分发**。这使 Notes 的 dual-run 调用面落后于 Claude，无法进入「disable-not-delete」的对标轨道。

本刀对标 3AN，把 Notes 的门面升级为「单 owner CoreNotes 的 delegate-to-Core 门面」，并在 7 条 `note_card_*` 命令入口加 `notes_owner()` 分发（flag 默认 off）。**不接插件运行时 storage、不 activate、不 dispatch**——那是 conformance 之后的 step 6/7，本刀只收口「调用面」。

## 目标与边界

1. `NotesBackend` trait 从 `list` 扩展到 7 条 `note_card_*` 的 delegate 面，`NotesCompatAdapter` 持有 Core backend（包装 `note_cards.rs` 的文件存储），`owner()` 恒为 `NotesCompatOwner::CoreNotes`。
2. 7 条 `note_card_*` 命令入口加 `notes_owner()` 分发：flag `MOSSX_NOTES_COMPAT_FACADE` 默认 off → 直接 Core（现有行为）；on → 经 facade → 同一 Core 实现（调用路径切换，非第二实现）。
3. **MUST NOT** 接插件运行时（不 activate / 不 dispatch / 不接 `DiskStorage` / 不读 `notes_storage` namespace）。
4. **MUST NOT** 删 `note_cards.rs` / `noteCards.ts` / `src/features/note-cards/**`（Slim 是后续 change）。
5. **MUST NOT** 默认开 flag、MUST NOT 开 Marketplace、MUST NOT 迁用户数据。
6. 产品行为保持 0% 变化：flag 默认 off，7 条命令走与当前完全一致的 Core 路径。

## Capabilities

- `notes-dual-run-call-surface-v1`
