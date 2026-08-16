# Wave Skills Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-skills-export-surface`  
> 结论：**方向正确。AppShell / Composer / Settings / Context Ledger 改走 `@mossx/plugin-skills/runtime` 与 `/ui`。** 实现仍在 `src/features/skills` 与 `src/features/curated-skills`。未激活 Host。

## 证明

- `openspec validate plugin-skills-export-surface --strict --no-interactive`
- vitest 包出口 + indicator + OtherSection：10 passed
