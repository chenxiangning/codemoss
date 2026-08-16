# Wave Gemini Engine Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-gemini-export-surface`  
> 结论：**方向正确。会话 history factory / Settings / resume 改走 `@mossx/plugin-engine-gemini/runtime`。** 实现仍在 `src/features/threads/loaders/gemini*`。未删 `engine/claude*`。未激活 Host。

## 证明

- `openspec validate plugin-engine-gemini-export-surface --strict --no-interactive`
- vitest 包出口 + history fallbacks：6 passed
