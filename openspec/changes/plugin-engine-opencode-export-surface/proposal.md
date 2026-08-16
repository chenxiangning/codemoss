# Proposal: plugin-engine-opencode-export-surface

> OpenSpec change id: `plugin-engine-opencode-export-surface`

## Why

OpenCode 过渡仓只有 Manifest。会话 history factory 仍直达 `src/features/threads/loaders/opencode*`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-engine-opencode` MUST 再导出 runtime。
2. 会话 history factory 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/threads/loaders/opencode*`。
4. MUST NOT 删 `engine/claude*`，MUST NOT 激活 Host。
5. 同族 loader 测试仍可直达实现。当前没有独立 parser 产品导入，MUST NOT 发明假面板。

## Capabilities

- `plugin-engine-opencode-export-surface-v1`
