# Wave Browser Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-browser-export-surface`  
> 结论：**方向正确。AppShell / 布局 / 会话 / Composer 改走 `@mossx/plugin-browser/runtime` 与 `/ui`。** 实现仍在 `src/features/browser-agent`。Tauri 类型桥暂留。未激活 Host。

## 证明

- `openspec validate plugin-browser-export-surface --strict --no-interactive`
- vitest 包出口 + WorkspaceHome + layout nodes + openHtml：49 passed
