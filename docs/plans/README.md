---
type: index
status: active
---

<!-- DOC-LIFECYCLE: active-index -->
# Plans 文档索引

> [!IMPORTANT]
> **Lifecycle: Active section index.** 当前**正式执行**仍以 active OpenSpec change 为准。下列含 draft plan 时，需经确认并 OpenSpec 化后才能当 backlog 执行；implemented 文件中的 unchecked checkbox 不构成 active backlog。

## Draft / pending confirmation

- [Shared Session recovery exit closure](./2026-08-04-shared-session-recovery-exit-closure.md) — P0：恢复出口闭环（跨平台）；**尚未** OpenSpec 化、未改代码。
- [0.9 插件合同移植（十流）](../architecture/plugin-platform/17-contract-port-to-0.9.md) — 从 `feature/plugin-mossx-0.8.9` **重写**插排/三根插头/本地市场到 0.9；不是 cherry-pick。与 0.9 上已有的「产品能力移植」（PI/Dock/Ask）分开。未在 0.9 立 OpenSpec 前禁止改 0.9 代码。

## Active execution plans

- [AppShell 高内聚低耦合优化](./2026-08-11-app-shell-cohesion-optimization.md) — **活文档**：P0-0 度量 → bag 瘦身 → Host 子树化 → 物理模块化；完成 Todo 后必须回写进度与 Progress Log。
- [History IO / 列表元数据屎山](../perf/2026-08-12-history-io-garbage-code-execution-todolist.md) — **活文档**：S0 → W0 列表止血 → W1 Catalog/Index → W2 窗口化 load → W3 搜索/usage；完成一项必须回写勾选与完成记录。

## Implemented historical plans

- [Composer popup fix](./2026-02-10-composer-popup-fix.md)
- [Unified workspace search](./2026-02-10-unified-workspace-search.md)
- [Project session management center](./2026-04-19-project-session-management-center-implementation.md)
- [Claude compact command adaptation](./2026-04-20-claude-compact-command-adaptation-implementation.md)
- [Context ledger then task center](./2026-05-03-context-ledger-then-task-center-implementation.md)
- [Browser dock phase 3](./2026-06-01-browser-dock-phase3.md)
- [Project map relationship dashboard](./2026-06-05-project-map-relationship-dashboard.md)
- [Project map API contract detail view](./2026-06-07-refine-project-map-api-contract-detail-view.md)
- [Claude provider drag reorder](./2026-06-20-claude-provider-drag-reorder.md)
- [Claude provider fetch models](./2026-06-20-claude-provider-fetch-models.md)
- [Multi-CLI provider/session foundation checklist](./2026-07-27-multi-cli-provider-session-foundation-task-checklist.md)

## Implemented architecture plans

- [Conversation canvas scroll ownership architecture](./2026-08-01-conversation-canvas-scroll-ownership-architecture.md) — Durable contract 已进入 main specs。
- [Unified conversation canvas architecture](./2026-08-01-unified-conversation-canvas-architecture.md) — Implementation 已归档。

## Superseded roadmaps

- [Phase 2 roadmap](./2026-02-10-phase2-roadmap.md) — 被后续 Project Memory/OpenSpec contracts 替代。

## Earlier archived plans

- [Archived plans index](./archived/README.md)

## Current planning source

- [OpenSpec changes](../../openspec/changes/)
- [OpenSpec main specifications](../../openspec/specs/README.md)
