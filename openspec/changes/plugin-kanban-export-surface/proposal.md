# Proposal: plugin-kanban-export-surface

> OpenSpec change id: `plugin-kanban-export-surface`

## Why

看板过渡仓只有 Manifest。产品导入仍直达 `src/features/kanban`。分包分层的下一步是让 AppShell 走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-kanban` MUST 再导出看板产品入口。
2. AppShell 生产导入 MUST 走该包，MUST NOT 再直达 `src/features/kanban`。
3. 产品实现 MUST 仍在 `src/features/kanban`。
4. MUST NOT 迁存储、MUST NOT 激活 Host、MUST NOT 改看板行为。

## Capabilities

- `plugin-kanban-export-surface-v1`
