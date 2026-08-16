# Wave Subagent UI Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-subagent-ui-export-surface`  
> 结论：**方向正确。布局 / Composer / Status / Git History 改走 `@mossx/plugin-subagent-ui/runtime` 与 `/ui`。** 实现仍在 `src/features/subagent-ui`。未激活 Host。

## 证明

- `openspec validate plugin-subagent-ui-export-surface --strict --no-interactive`
- vitest 包出口 + inspector store + isSubagentTool + run-status wire：20 passed
