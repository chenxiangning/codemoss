# Wave Kanban Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-kanban-export-surface`  
> 结论：**方向正确。AppShell 看板入口改走 `@mossx/plugin-kanban`。** 实现仍在 `src/features/kanban`。未迁存储，未激活 Host。

## 证明

- `openspec validate plugin-kanban-export-surface --strict --no-interactive`
- vitest 包出口 + AppShell 边界 / domains：197 passed
