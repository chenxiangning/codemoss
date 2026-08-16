# Wave Tasks Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-tasks-export-surface`  
> 结论：**方向正确。AppShell / WorkspaceHome / 布局改走 `@mossx/plugin-tasks/runtime` 与 `/ui`。** 实现仍在 `src/features/tasks`。未激活 Host。

## 证明

- `openspec validate plugin-tasks-export-surface --strict --no-interactive`
- vitest 包出口 + WorkspaceHome：8 passed
