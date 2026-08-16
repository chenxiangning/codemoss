# Proposal: plugin-subagent-ui-export-surface

> OpenSpec change id: `plugin-subagent-ui-export-surface`

## Why

Subagent UI 过渡仓只有 Manifest。布局 / Composer / Status / Git History 仍直达 `src/features/subagent-ui`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-subagent-ui` MUST 再导出 runtime / ui。
2. 布局、Composer、Status、Git History 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/subagent-ui`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-subagent-ui-export-surface-v1`
