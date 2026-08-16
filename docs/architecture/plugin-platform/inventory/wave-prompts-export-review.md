# Wave Prompts Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-prompts-export-surface`  
> 结论：**方向正确。AppShell / Composer / Settings / 布局改走 `@mossx/plugin-prompts/runtime` 与 `/ui`。** 实现仍在 `src/features/prompts`。未激活 Host。

## 证明

- `openspec validate plugin-prompts-export-surface --strict --no-interactive`
- vitest 包出口 + useCustomPrompts + promptUsage：13 passed
- ChatInputBoxAdapter：61 passed
