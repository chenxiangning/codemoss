# Wave Terminal Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-terminal-export-surface`  
> 结论：**方向正确。AppShell / 布局 / launch script / vendors 改走 `@mossx/plugin-terminal/runtime` 与 `/ui`。** 实现仍在 `src/features/terminal`。未激活 Host。

## 证明

- `openspec validate plugin-terminal-export-surface --strict --no-interactive`
- vitest 包出口 + workspace flows：13 passed
