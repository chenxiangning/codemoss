# Wave Collaboration Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-collaboration-export-surface`  
> 结论：**方向正确。AppShell 改走 `@mossx/plugin-collaboration/runtime`。** 当前没有独立 UI 出口，没有发明假面板。实现仍在 `src/features/collaboration`。未激活 Host。

## 证明

- `openspec validate plugin-collaboration-export-surface --strict --no-interactive`
- vitest 包出口 + collaboration hooks：7 passed
