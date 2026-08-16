# Proposal: plugin-shared-session-export-surface

> OpenSpec change id: `plugin-shared-session-export-surface`

## Why

Shared Session 过渡仓只有 Manifest。AppShell / 布局 / Composer / 会话仍直达 `src/features/shared-session`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-shared-session` MUST 再导出 runtime / ui。
2. AppShell、布局、Composer、会话生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/shared-session`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. Email 是 Rust-only later-plugin，本刀 MUST NOT 发明前端 Email 面板。

## Capabilities

- `plugin-shared-session-export-surface-v1`
