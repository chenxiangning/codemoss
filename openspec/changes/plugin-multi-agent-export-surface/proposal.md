# Proposal: plugin-multi-agent-export-surface

> OpenSpec change id: `plugin-multi-agent-export-surface`

## Why

Multi-Agent 过渡仓只有 Manifest。布局 / Composer / 会话仍直达 `src/features/multi-agent`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-multi-agent` MUST 再导出 runtime / ui。
2. 布局、Composer、会话生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/multi-agent`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-multi-agent-export-surface-v1`
