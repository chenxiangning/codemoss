# Wave Spec Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-spec-export-surface`  
> 结论：**方向正确。AppShell / 布局 / 会话 / Files 改走 `@mossx/plugin-spec/runtime` 与 `/ui`。** 实现仍在 `src/features/spec`。未激活 Host。

## 证明

- `openspec validate plugin-spec-export-surface --strict --no-interactive`
- vitest 包出口 + lazy 边界：8 passed
