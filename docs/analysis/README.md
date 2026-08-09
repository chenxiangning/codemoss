---
type: index
status: active
---

<!-- DOC-LIFECYCLE: active-index -->
# Analysis 文档索引

> [!IMPORTANT]
> **Lifecycle: Active section index.** 本索引校准于 2026-08-08，当前产品版本为 `0.8.5`。Analysis 解释实现与决策背景，不是行为事实源；current contract 以 OpenSpec main specs 与代码为准。

## Current reference

- [Canvas live tool projection matrix](./canvas-live-tool-projection-matrix-2026-08-01.md) — Active technical reference；Grok history projection change 已归档。
- [Conversation canvas structure](./conversation-canvas-structure-2026-07-31.md) — Active architecture reference。
- [Live settle assistant/tool order](./live-settle-assistant-tool-order-2026-08-04.md) — Active incident analysis；Shared×Claude 已确认「流式对 / 结束后偶发错序 / 历史恢复」；Shared+Native 跨引擎同源矩阵。
- [Native session provider select vs disk overwrite](./native-session-provider-select-vs-disk-overwrite-2026-07-31.md) — Active session-selection contract explanation。
- [Native vs Shared CLI explained](./native-vs-shared-cli-explained.md) — Active product/engineering guide。
- [Shared create / open local catalog stale mapping](./shared-create-local-catalog-stale-mapping-2026-08-08.md) — Active fix reference；Shared 创建权威 catalog + 打开历史文案/图标 mapping 同源。
- [Workspace switch session catalog performance regression](./workspace-switch-session-catalog-performance-regression-2026-08-08.md) — Active incident analysis；校准 v0.7.16/v0.8.0 commits、exhaustive projection 主根因、首轮修复证伪与性能治理顺序。
- [React #185 Maximum Update Depth playbook](./react-185-maximum-update-depth-playbook.md) — Active troubleshooting runbook；最新 case `C-20260805-01`（0.7.16 Messages canvas 空集合 thrash / `App-BG-8EZ_F`；前案 C-20260804-01..03）。

## Resolved incidents and closure evidence

- [Shared session model picker native fallback](./shared-session-model-picker-native-fallback-2026-08-02.md) — Resolved 2026-08-03；identity、optimistic persistence 与 stale hydrate protection 已闭环。
- [Unify conversation canvas review](./unify-conversation-canvas-review-2026-08-01.md) — Implemented review/closure evidence。

## Historical snapshots

- [Client shortcuts and priorities, 2026-07](./client-shortcuts-and-priorities-2026-07.md) — Historical priority snapshot；不得作为 current backlog。

## Canonical pointers

- [OpenSpec main specifications](../../openspec/specs/README.md)
- [Archived unify-conversation-canvas change](../../openspec/changes/archive/2026-08-03-unify-conversation-canvas/)
- [Archived scroll-ownership change](../../openspec/changes/archive/2026-08-03-refactor-conversation-canvas-scroll-ownership/)
- [Archived shared target race-and-merge change](../../openspec/changes/archive/2026-08-03-fix-shared-session-target-race-and-merge/)
- [Archived Grok history projection change](../../openspec/changes/archive/2026-08-03-fix-grok-history-tool-projection/)
