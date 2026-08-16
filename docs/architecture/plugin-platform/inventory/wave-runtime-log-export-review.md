# Wave Runtime Log Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-log-export-surface`  
> 结论：**方向正确。App 控制器与 dock 改走 `@mossx/plugin-runtime-log/runtime` 与 `/ui`。** 实现仍在 `src/features/runtime-log`。未激活 Host。

## 证明

- `openspec validate plugin-runtime-log-export-surface --strict --no-interactive`
- vitest 包出口 + session hook + panel：9 passed
