# Wave Kimi Engine Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-kimi-export-surface`  
> 结论：**方向正确。会话 history factory / resume 改走 `@mossx/plugin-engine-kimi/runtime`。** 实现仍在 `src/features/threads/loaders/kimi*`。未删 `engine/claude*`。未激活 Host。

## 证明

- `openspec validate plugin-engine-kimi-export-surface --strict --no-interactive`
- vitest 包出口 + history fallbacks：9 passed（与 Grok / OpenCode / Pi 同批）
