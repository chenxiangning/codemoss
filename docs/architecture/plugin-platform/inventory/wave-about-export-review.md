# Wave About Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-about-export-surface`  
> 结论：**方向正确。router 改走 `@mossx/plugin-about/ui`。** Plan 当前没有外部产品导入，本刀没有发明接线。实现仍在 `src/features/about`。未激活 Host。

## 证明

- `openspec validate plugin-about-export-surface --strict --no-interactive`
- vitest 包出口 + router：10 passed
