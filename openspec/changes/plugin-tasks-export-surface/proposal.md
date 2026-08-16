# Proposal: plugin-tasks-export-surface

> OpenSpec change id: `plugin-tasks-export-surface`

## Why

Tasks 过渡仓只有 Manifest。AppShell / WorkspaceHome 仍直达 `src/features/tasks`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-tasks` MUST 再导出 runtime / ui。
2. AppShell 与 WorkspaceHome 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/tasks`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-tasks-export-surface-v1`
