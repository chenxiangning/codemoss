# Design: add-session-index-import-daemon

## Context

侧栏 first-paint 只读 SQLite。外部 CLI 会话要进库，但不能堵加载。

## Goals / Non-Goals

**Goals:** App 内间隔导入；有界；幂等；有变更才通知 UI 再 SELECT。

**Non-Goals:** 独立 OS 服务；exhaustive walk；改 hide/parent 规则。

## Decisions

### D1. 进程内循环，不是 OS daemon

与现有 runtime reconcile 一样挂在 `lib.rs` setup。App 退出即停。

### D2. 复用 `sync_session_index_core(..., force=false)`

Writers 已有 fingerprint + tombstone。limit=50。

### D3. 性能

- 首次延迟 45s，间隔 90s
- 全局 mutex：上一 tick 未完则跳过
- 每 tick 最多 4 个工作区，串行
- 跳过空 path

### D4. UI

事件 `session-index-imported`：`{ workspaceIds, upserted }`。仅 `upserted>0` 时 emit。FE first-paint 再读 SQLite。

## Risks

- [Risk] 导入与用户删除竞态 → tombstone WHERE 保护
- [Risk] 多工作区 tick 太长 → 每 tick 上限 + 跳过重叠
