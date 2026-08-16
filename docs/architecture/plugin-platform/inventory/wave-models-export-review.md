# Wave Models Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-models-export-surface`  
> 结论：**方向正确。AppShell / Composer / Settings / Vendors / Engine 改走 `@mossx/plugin-models/runtime` 与 `/ui`。** 实现仍在 `src/features/models`。未激活 Host。`messages/orchestration/models` 不是这个插件。

## 证明

- `openspec validate plugin-models-export-surface --strict --no-interactive`
- vitest 包出口 + provider types + shared-session：14 passed
