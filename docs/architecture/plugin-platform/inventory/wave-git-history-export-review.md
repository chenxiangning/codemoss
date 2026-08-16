# Wave Git History Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-git-history-export-surface`  
> 结论：**方向正确。AppShell / 布局 / Git / Files 改走 `@mossx/plugin-git-history/runtime` 与 `/ui`。** 实现仍在 `src/features/git-history`。未激活 Host。

## 证明

- `openspec validate plugin-git-history-export-surface --strict --no-interactive`
- vitest 包出口 + lazy 边界 + layout nodes：38 passed
