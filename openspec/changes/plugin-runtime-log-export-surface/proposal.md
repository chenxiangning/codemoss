# Proposal: plugin-runtime-log-export-surface

> OpenSpec change id: `plugin-runtime-log-export-surface`

## Why

Runtime Log 过渡仓只有 Manifest。App 控制器与 dock 仍直达 `src/features/runtime-log`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-runtime-log` MUST 再导出 runtime / ui。
2. App 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/runtime-log`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-runtime-log-export-surface-v1`
