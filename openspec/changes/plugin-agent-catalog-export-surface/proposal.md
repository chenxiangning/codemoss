# Proposal: plugin-agent-catalog-export-surface

> OpenSpec change id: `plugin-agent-catalog-export-surface`

## Why

Agent Catalog 过渡仓只有 Manifest。AppShell / 会话 / Settings 仍直达 `src/features/agent-catalog`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-agent-catalog` MUST 再导出 runtime / ui。
2. AppShell、会话、Settings 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/agent-catalog`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。

## Capabilities

- `plugin-agent-catalog-export-surface-v1`
