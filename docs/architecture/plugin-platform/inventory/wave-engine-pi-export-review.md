# Wave Pi Engine Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-pi-export-surface`  
> 结论：**方向正确。会话 history factory / resume 改走 `@mossx/plugin-engine-pi/runtime`。** 实现仍在 `src/features/threads/loaders/pi*`。未删 `engine/claude*`。未激活 Host。

## 证明

- `openspec validate plugin-engine-pi-export-surface --strict --no-interactive`
- vitest 包出口 + history fallbacks：9 passed（与 Grok / Kimi / OpenCode 同批）
