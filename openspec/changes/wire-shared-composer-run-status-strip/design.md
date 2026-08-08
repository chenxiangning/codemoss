## Context

- UI：`ComposerRunStatusStrip`（朱昆鹏 2026-08-07：`9703bdba6` / 撤销 `66330bc93`）。
- 数据：`buildTurnFileChangesByBoundaryId` + `mergeTurnFileChangesSummaries`；子代理 `useStatusPanelData`。
- 布局：`ActiveCanvasComposer` 用 `activeCanvasStore` 注入 `items` / `threadItemsByThread`；`useLayoutNodes` 故意传 `EMPTY_ACTIVE_CANVAS_ITEMS` 防根击穿。
- 协作：工具写在 `agent-canvas:shared:<uuid>:<attemptId>`，主 shared 时间线无 edit tools。

> **完整目标架构（含历史 durable）见**  
> [`docs/architecture/composer-session-file-edit-ledger-design.md`](../../../docs/architecture/composer-session-file-edit-ledger-design.md)。  
> 本 change 仅覆盖 **live fan-in 过渡切片**；历史可见必须以 Session File-Edit Ledger 另开 change。

## Goals / Non-Goals

**Goals:** Shared 普通 + 协作 strip 在 **live** 下尽量可见；协作 fan-in agent-canvas 变更；撤销复用 git restore。

**Non-Goals:** 主幕重渲染工具卡；**本切片不解决冷启动历史**（见上文档 §3 Ledger）；改 Strip UI。

## Decisions

### 1. 合成源仅服务「已编辑」（硬边界）

```ts
collectRunStatusSourceItems({
  mainItems,           // Composer 当前 items（ActiveCanvas 覆盖后）
  threadItemsByThread,
  activeThreadId,
})
// 只并入 agent-canvas:{activeShared}:* ，禁止 includes 模糊匹配、禁止 child 全量并入
```

| 派生 | 数据源 |
|------|--------|
| **已编辑** sessionFileChanges | `collectRunStatusSourceItems` → turnFileChanges |
| **子代理 / todo / plan** | **仅** 主时间线 `performanceScopedItems` + 既有 useStatusPanelData scoped 子线程 |

**禁止** 把 agent-canvas 全量 items 喂给 `useStatusPanelData`（会污染子代理扫描，且曾导致主幕协作体验异常）。

### 2. 协作语义

- 「已编辑」= 主线 edit tools ∪ 当前 shared 下 agent-canvas attempt 的 fileChange/edit。
- 不按 stage 分 pill；节点细节仍在右侧 Inspector。
- 主幕 HistoryFold / sticky 编排卡路径 **零改动**。

### 3. 性能

- 合成在 Composer 内 `useMemo`，deps：`items`、`threadItemsByThread`、`activeThreadId`、`threadParentById`。
- agent-canvas 键数量随 attempt 线性；只读引用 concat，不做深拷贝。
- 保持 ActiveCanvas 空 props 不变。

### 4. 基石文档

在「零、当前实现校准」增加一行：Composer run-status 数据源 = 主 items ∪ agent-canvas ∪ child threads。

## Risks

| Risk | Mitigation |
|------|------------|
| canvas 无 path/diff 导致 0 行 | 与 native 同 parse；0 增删仍过滤 |
| 合成数组过大 | 仅 tool 相关段；后续可只抽 tool 项 |

## Open Questions

- 无（用户已确认要 shared 普通+协作引用同一 UI）。
