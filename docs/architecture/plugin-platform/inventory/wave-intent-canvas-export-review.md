# Wave Intent Canvas Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-intent-canvas-export-surface`  
> 结论：**方向正确。AppShell / 布局 / 会话改走 `@mossx/plugin-intent-canvas/runtime` 与 `/ui`。** 实现仍在 `src/features/intent-canvas`。未迁存储，未激活 Host。

## 证明

- `openspec validate plugin-intent-canvas-export-surface --strict --no-interactive`
- vitest 包出口 + lazy 边界 + layout nodes：38 passed

## 边界

- Project Map 内部仍可直达 Intent Canvas 实现；本刀只改 AppShell / 布局 / 会话 / Composer / Files 入口
