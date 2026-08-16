# Wave Client Documentation Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-client-documentation-export-surface`  
> 结论：**方向正确。AppShell / router 改走 `@mossx/plugin-client-documentation/runtime` 与 `/ui`。** 实现仍在 `src/features/client-documentation`。未激活 Host。

## 证明

- `openspec validate plugin-client-documentation-export-surface --strict --no-interactive`
- vitest 包出口 + window helper + router：15 passed
