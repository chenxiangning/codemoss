# Wave Project Map Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-project-map-export-surface`  
> 结论：**方向正确。AppShell / 布局改走 `@mossx/plugin-project-map/runtime` 与 `/ui`。** 实现仍在 `src/features/project-map`。未迁存储，未激活 Host。

## 证明

- `openspec validate plugin-project-map-export-surface --strict --no-interactive`
- vitest 包出口 + lazy 边界 + layout nodes + search radar：54 passed（出口断言修正后 8 passed 复核）
