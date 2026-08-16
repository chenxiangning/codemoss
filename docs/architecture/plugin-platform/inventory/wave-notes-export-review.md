# Wave Notes Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-notes-export-surface`  
> 结论：**方向正确。产品 Notes 导入改走 `@mossx/plugin-notes/runtime` 与 `/ui`。** 实现仍在 `src/features/note-cards`。`note_cards.rs` 未迁。未激活 Host。

## 证明

- `openspec validate plugin-notes-export-surface --strict --no-interactive`
- vitest 包出口 + layout visibility + memory-pick：41 passed
- 便签注入单测：passed
- Memory Scout 超时是预存问题，stash 回旧导入后同样超时，不计入本刀

## 边界

- 会话路径只走 `runtime`，避免把 Notes UI 拉进 messaging 图
- Vite alias 用精确正则，避免 `@mossx/plugin-notes` 前缀吞掉 `/runtime` `/ui`
