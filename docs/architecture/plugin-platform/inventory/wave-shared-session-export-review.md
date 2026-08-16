# Wave Shared Session Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-shared-session-export-surface`  
> 结论：**方向正确。AppShell / 布局 / Composer / 会话 / 设置改走 `@mossx/plugin-shared-session/runtime` 与 `/ui`。** Email 是 Rust-only，没有发明前端 Email 面板。实现仍在 `src/features/shared-session`。未激活 Host。

## 证明

- `openspec validate plugin-shared-session-export-surface --strict --no-interactive`
- vitest 包出口 + identity/engines + sessionActions：16 passed
- layout nodes + create-initial-target + sessionProjection：41 passed
