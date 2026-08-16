# Wave OpenCode Engine Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-opencode-export-surface`  
> 结论：**方向正确。会话 history factory 改走 `@mossx/plugin-engine-opencode/runtime`。** 实现仍在 `src/features/threads/loaders/opencode*`。当前没有独立 parser 产品导入，没有发明假面板。未删 `engine/claude*`。未激活 Host。

## 证明

- `openspec validate plugin-engine-opencode-export-surface --strict --no-interactive`
- vitest 包出口 + history fallbacks：9 passed（与 Grok / Kimi / Pi 同批）
