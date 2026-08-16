# Wave Status Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-status-export-surface`  
> 结论：**方向正确。布局 / Composer / Settings / subagent-ui 改走 `@mossx/plugin-status/runtime` 与 `/ui`。** 实现仍在 `src/features/status-panel`。未激活 Host。

## 证明

- `openspec validate plugin-status-export-surface --strict --no-interactive`
- vitest 包出口 + run-status + governance replay：13 passed
