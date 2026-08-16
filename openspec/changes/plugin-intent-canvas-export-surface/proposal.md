# Proposal: plugin-intent-canvas-export-surface

> OpenSpec change id: `plugin-intent-canvas-export-surface`

## Why

Intent Canvas 过渡仓只有 Manifest。AppShell / 布局 / 会话仍直达 `src/features/intent-canvas`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-intent-canvas` MUST 再导出 runtime / ui。
2. AppShell、布局、会话生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/intent-canvas`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-intent-canvas-export-surface-v1`
