# Wave Agent Catalog Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-agent-catalog-export-surface`  
> 结论：**方向正确。AppShell / 会话 / Composer / Settings 改走 `@mossx/plugin-agent-catalog/runtime` 与 `/ui`。** 实现仍在 `src/features/agent-catalog`。未激活 Host。

## 证明

- `openspec validate plugin-agent-catalog-export-surface --strict --no-interactive`
- vitest 包出口 + catalog hook + section：4 passed
