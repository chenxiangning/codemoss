# Proposal: plugin-client-ui-visibility-export-surface

> OpenSpec change id: `plugin-client-ui-visibility-export-surface`

## Why

Client UI Visibility 过渡仓只有 Manifest。AppShell / 布局 / Settings 仍直达 `src/features/client-ui-visibility`。下一步让生产导入走包出口，源码先留在原处。

## 目标与边界

1. `@mossx/plugin-client-ui-visibility` MUST 再导出 runtime。
2. AppShell、布局、Settings 生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/client-ui-visibility`。
4. MUST NOT 迁存储、MUST NOT 激活 Host。
5. 当前没有独立 UI 面板，MUST NOT 发明假面板。

## Capabilities

- `plugin-client-ui-visibility-export-surface-v1`
