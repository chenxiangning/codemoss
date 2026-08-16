# Proposal: plugin-models-export-surface

> OpenSpec change id: `plugin-models-export-surface`

## Why

Models 过渡仓只有 Manifest。AppShell / Composer / Settings 仍直达 `src/features/models`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-models` MUST 再导出 runtime / ui。
2. AppShell、Composer、Settings 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/models`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. `src/features/messages/orchestration/models` MUST NOT 被当成这个插件。

## Capabilities

- `plugin-models-export-surface-v1`
