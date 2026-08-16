# Wave Operation Facts Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-operation-facts-export-surface`  
> 结论：**方向正确。Status / Composer / session-activity 改走 `@mossx/plugin-operation-facts/runtime`。** 没有发明 UI 面板。实现仍在 `src/features/operation-facts`。未激活 Host。

## 证明

- `openspec validate plugin-operation-facts-export-surface --strict --no-interactive`
- vitest 包出口 + operationFacts：17 passed
