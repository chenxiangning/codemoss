# Proposal: plugin-about-export-surface

> OpenSpec change id: `plugin-about-export-surface`

## Why

About 过渡仓只有 Manifest。router 仍直达 `src/features/about`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-about` MUST 再导出 ui。
2. router 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/about`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. Plan 当前没有外部产品导入，本刀 MUST NOT 发明 Plan 接线。

## Capabilities

- `plugin-about-export-surface-v1`
