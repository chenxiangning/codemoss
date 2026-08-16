# Proposal: plugin-browser-export-surface

> OpenSpec change id: `plugin-browser-export-surface`

## Why

Browser 过渡仓只有 Manifest。AppShell / 布局 / 会话仍直达 `src/features/browser-agent`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-browser` MUST 再导出 runtime / ui。
2. AppShell、布局、会话、Composer 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/browser-agent`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。Tauri 类型桥可暂留。

## Capabilities

- `plugin-browser-export-surface-v1`
