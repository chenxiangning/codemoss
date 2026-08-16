# Wave Debug Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-debug-export-surface`  
> 结论：**方向正确。AppShell / 布局 / 存储维护 / 会话诊断改走 `@mossx/plugin-debug/runtime` 与 `/ui`。** 实现仍在 `src/features/debug`。未激活 Host。

## 证明

- `openspec validate plugin-debug-export-surface --strict --no-interactive`
- vitest 包出口 + useDebugLog + clientStoreMaintenance：20 passed
