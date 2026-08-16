# Wave Vendors Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-vendors-export-surface`  
> 结论：**方向正确。AppShell / Settings / Composer / shared-session 改走 `@mossx/plugin-vendors/runtime` 与 `/ui`。** 实现仍在 `src/features/vendors`。未激活 Host。

## 证明

- `openspec validate plugin-vendors-export-surface --strict --no-interactive`
- vitest 包出口 + catalog sync + shared-session + provider types：19 passed
