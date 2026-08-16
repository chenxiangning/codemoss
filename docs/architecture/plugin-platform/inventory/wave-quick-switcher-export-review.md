# Wave Quick Switcher Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-quick-switcher-export-surface`  
> 结论：**方向正确。AppShell / Git / Search 消费 `@mossx/plugin-quick-switcher/runtime` 与 `/ui`。** Search 仍是 Core，没有发明 `com.mossx.search`。未激活 Host。

## 证明

- `openspec validate plugin-quick-switcher-export-surface --strict --no-interactive`
- vitest 包出口 + lazy 边界 + layout nodes：38 passed
