# Wave Codex Engine Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-codex-export-surface`  
> 结论：**方向正确。会话 history factory / Settings 改走 `@mossx/plugin-engine-codex/runtime`。** 实现仍在 `src/features/threads/loaders/codex*`。未删 `engine/claude*`。未激活 Host。

## 证明

- `openspec validate plugin-engine-codex-export-surface --strict --no-interactive`
- vitest 包出口 + history fallbacks：6 passed
