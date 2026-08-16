# Wave Governance Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-governance-export-surface`  
> 结论：**方向正确。Status Panel 改走 `@mossx/plugin-governance/runtime`。** 当前没有独立 UI 出口，没有发明假面板。实现仍在 `src/features/governance`。未激活 Host。

## 证明

- `openspec validate plugin-governance-export-surface --strict --no-interactive`
- vitest 包出口 + bridge policies + harness evidence：13 passed
