## Why

Codex CLI Provider Continuation 已能创建目标 thread，但目标 identity 被错误保存为
`codex:<thread-id>`，与 Codex catalog 的 raw `<thread-id>` contract 不一致，导致自动选中
错误 identity、Continuation metadata/F​​amily 无法覆盖真实目录行，并触发普通 Session 或
恢复提示。Structured history import 同时缺少闭合 control boundary，使
`environment_context`、`AGENTS.md` 等 bootstrap payload 泄露到普通 Canvas。

## 目标与边界

- Codex target 从 runtime、operation result、catalog metadata 到 frontend selection 全链路
  使用 authoritative raw thread id。
- 已产生的 duplicated `codex:<workspace>:codex:<thread-id>` metadata 必须兼容投影，并恢复
  连续 Provider Continuation Family。
- Codex structured import 必须形成显式、闭合的 control envelope；presentation 隐藏 envelope
  内全部 imported history，随后真实 user turn 正常显示。
- 复用 Claude 已有的 Sidebar Family fence、Continuation badge 与 Context Card，不新增
  Codex 专属视觉分支。

## 非目标

- 不修改来源或目标 vendor history 的普通用户内容。
- 不改变 Claude/Kimi target identity、bootstrap transport 或 Provider binding contract。
- 不改变 Context Package portability、token budget 或 omission policy。
- 不重构通用 Codex thread creation、streaming reducer 或 Sidebar layout。

## What Changes

- Codex continuation `resultSessionId` 与 metadata 写入改为 raw target thread id。
- Catalog metadata lookup 增加对历史 duplicated Codex stable key 的定向兼容，并按
  authoritative source lineage 修复 legacy Family projection。
- Codex structured import 在 package marker 后追加 exact acceptance marker，建立闭合 envelope。
- Context protocol presentation filter 改为显式 open/close state machine，隐藏 envelope 内任意
  role 的 imported items，同时保留 envelope 后的普通对话。
- Messages 从 catalog authoritative origin 接收 presentation-only flag，仅在 Codex Provider
  Continuation 中隐藏 control prompt 之前的 host bootstrap 与首个真实 user turn 之前的
  bootstrap output。
- Ready path 等待既有 workspace catalog refresh settle 后再选择 target，保证 Canvas 首帧
  已携带 authoritative continuation metadata，消除 bootstrap 闪烁。
- 增加 backend/frontend regression tests 与 executable Trellis contract。

## 方案取舍

### 方案 A：修正 identity contract 并闭合 import envelope（采用）

在 authoritative boundary 修复 raw identity，同时为 structured import 增加显式结束 marker。
该方案保留高保真 history import，并让现有 UI 自然消费正确 metadata。

### 方案 B：仅在 Sidebar 隐藏异常 Session（不采用）

只能遮住症状，错误 result identity、恢复提示、Family lineage 与来源导航仍会失效。

### 方案 C：Codex 永久降级为 prompt transport（不采用）

可以绕开 imported history 展示，但会丢失已验证的 `thread/inject_items` 高保真能力，违背现有
capability-driven transport contract。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `native-provider-continuation`: Codex target identity 与 structured import control envelope
  必须可被稳定选择和完整隐藏。
- `workspace-session-catalog-projection`: Catalog 必须兼容历史 duplicated Codex continuation
  metadata key，并恢复 authoritative Family projection。

## Impact

- Backend：`src-tauri/src/native_continuation/commands.rs`、
  `src-tauri/src/shared_session_v2.rs`、`src-tauri/src/session_management.rs`。
- Frontend：`src/utils/contextProtocol.ts`、`src/features/messages/**`、
  `src/features/layout/hooks/**`、`src/features/app/hooks/useSidebarMenus.test.tsx`
  及相关 focused tests。
- Contracts：`dev-guidelines/backend/native-provider-continuation-contract.md` 与本 change delta。
- IPC shape 与依赖不变；不新增数据库 schema。

## 验收标准

- 一次 Codex Provider switch 只对应一个 raw target catalog identity，完成后自动选择该行。
- target row 获得 `provider-continuation`、Provider snapshot 与正确 Family lineage。
- 连续两次 Codex Provider switch 进入同一个 presentation Family fence。
- Canvas 不显示 package/accepted marker、`environment_context`、`AGENTS.md` 或 imported
  bootstrap history；完成后的普通 user turn 正常显示。
- 历史 duplicated metadata 可在不修改 vendor history 的前提下恢复展示。
- Focused Rust/Vitest、typecheck、runtime contracts 与 OpenSpec strict validation 通过。
