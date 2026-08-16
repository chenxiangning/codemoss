# Proposal: plugin-status-export-surface

> OpenSpec change id: `plugin-status-export-surface`

## Why

Status 过渡仓只有 Manifest。布局 / Composer 仍直达 `src/features/status-panel`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-status` MUST 再导出 runtime / ui。
2. 布局与 Composer 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/status-panel`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-status-export-surface-v1`
