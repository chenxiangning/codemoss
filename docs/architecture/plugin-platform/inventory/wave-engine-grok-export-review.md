# Wave Grok Engine Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-grok-export-surface`  
> 结论：**方向正确。会话 history factory / resume 改走 `@mossx/plugin-engine-grok/runtime`。** 实现仍在 `src/features/threads/loaders/grok*`。未删 `engine/claude*`。未激活 Host。

## 证明

- `openspec validate plugin-engine-grok-export-surface --strict --no-interactive`
- vitest 包出口 + history fallbacks：9 passed（与 Kimi / OpenCode / Pi 同批）
