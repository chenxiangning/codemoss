# Proposal: plugin-engine-claude-export-surface

> OpenSpec change id: `plugin-engine-claude-export-surface`

## Why

Claude 过渡仓只有 Manifest。前端产品导入仍直达 `src/features/**/claude*`。下一步让 AppShell / 会话 / 模型走包出口，Rust 实现仍留在 `engine/claude*`。

## 目标与边界

1. `@mossx/plugin-engine-claude` MUST 再导出 Claude 前端入口。
2. AppShell 生产导入 MUST 走该包。
3. `src-tauri/src/engine/claude*` MUST 仍存在。
4. MUST NOT 默认打开 `MOSSX_CLAUDE_COMPAT_FACADE`，MUST NOT 激活 Host。

## Capabilities

- `plugin-engine-claude-export-surface-v1`
