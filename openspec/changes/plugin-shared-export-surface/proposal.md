# Proposal: plugin-shared-export-surface

> OpenSpec change id: `plugin-shared-export-surface`

## Why

Shared 过渡仓只有 Manifest。Settings / Workspaces 仍直达 `src/features/shared`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-shared` MUST 再导出 runtime / ui。
2. Settings、Workspaces 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/shared`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. File editor cards 当前没有产品导入，仍 MUST 从 `/ui` 再导出。

## Capabilities

- `plugin-shared-export-surface-v1`
