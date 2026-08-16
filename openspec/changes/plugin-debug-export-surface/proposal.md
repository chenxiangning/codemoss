# Proposal: plugin-debug-export-surface

> OpenSpec change id: `plugin-debug-export-surface`

## Why

Debug 过渡仓只有 Manifest。AppShell / 布局 / 存储维护仍直达 `src/features/debug`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-debug` MUST 再导出 runtime / ui。
2. AppShell、布局、存储维护生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/debug`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-debug-export-surface-v1`
