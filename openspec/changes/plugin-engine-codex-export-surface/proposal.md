# Proposal: plugin-engine-codex-export-surface

> OpenSpec change id: `plugin-engine-codex-export-surface`

## Why

Codex 过渡仓只有 Manifest。会话 history factory / Settings 仍直达 `src/features/threads/loaders/codex*`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-engine-codex` MUST 再导出 runtime。
2. 会话 history factory 与 Settings 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/threads/loaders/codex*`。
4. MUST NOT 删 `engine/claude*`，MUST NOT 激活 Host。
5. 同族 loader 测试仍可直达实现。

## Capabilities

- `plugin-engine-codex-export-surface-v1`
