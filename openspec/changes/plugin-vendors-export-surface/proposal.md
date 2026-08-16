# Proposal: plugin-vendors-export-surface

> OpenSpec change id: `plugin-vendors-export-surface`

## Why

Vendors 过渡仓只有 Manifest。AppShell / Settings / Composer 仍直达 `src/features/vendors`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-vendors` MUST 再导出 runtime / ui。
2. AppShell、Settings、Composer 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/vendors`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-vendors-export-surface-v1`
