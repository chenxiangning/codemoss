# Proposal: plugin-client-documentation-export-surface

> OpenSpec change id: `plugin-client-documentation-export-surface`

## Why

Client Documentation 过渡仓只有 Manifest。AppShell / router 仍直达 `src/features/client-documentation`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-client-documentation` MUST 再导出 runtime / ui。
2. AppShell、router 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/client-documentation`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-client-documentation-export-surface-v1`
