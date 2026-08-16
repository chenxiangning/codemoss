# Wave Prompt Distill Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-prompt-distill-export-surface`  
> 结论：**方向正确。Messages 改走 `@mossx/plugin-prompt-distill/runtime` 与 `/ui`。** 实现仍在 `src/features/prompt-distill`。未激活 Host。

## 证明

- `openspec validate plugin-prompt-distill-export-surface --strict --no-interactive`
- vitest 包出口 + distillation hook：10 passed
