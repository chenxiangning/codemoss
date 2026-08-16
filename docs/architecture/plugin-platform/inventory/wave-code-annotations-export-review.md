# Wave Code Annotations Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-code-annotations-export-surface`  
> 结论：**方向正确。布局 / Composer / Files / Git / Status / Context Ledger 改走 `@mossx/plugin-code-annotations/runtime`。** 没有发明 UI 面板。实现仍在 `src/features/code-annotations`。未激活 Host。

## 证明

- `openspec validate plugin-code-annotations-export-surface --strict --no-interactive`
- vitest 包出口 + utils + Composer file-reference：34 passed
