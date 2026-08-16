# Wave Client UI Visibility Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-client-ui-visibility-export-surface`  
> 结论：**方向正确。AppShell / 布局 / Settings / 文档测试改走 `@mossx/plugin-client-ui-visibility/runtime`。** 没有发明 UI 面板。实现仍在 `src/features/client-ui-visibility`。未激活 Host。

## 证明

- `openspec validate plugin-client-ui-visibility-export-surface --strict --no-interactive`
- vitest 包出口 + layout nodes + visibility utils：通过
- `useClientUiVisibility` reset 与 documentation control 对齐失败在 HEAD 已存在，本刀未改实现

## 不在本刀

- 修既有 visibility default / documentation control 漂移
- 远程 Marketplace / Host 激活
