# Wave Multi-Agent Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-multi-agent-export-surface`  
> 结论：**方向正确。布局 / Composer / 会话 / Messages 改走 `@mossx/plugin-multi-agent/runtime` 与 `/ui`。** 实现仍在 `src/features/multi-agent`。未激活 Host。

## 证明

- `openspec validate plugin-multi-agent-export-surface --strict --no-interactive`
- vitest 包出口 + canvas + agentCanvasThread + sharedHistoryLoader：44 passed
