# Wave UI-1 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-rack-readonly-surface`  
> 论文对齐：config 是真相；展示不是 activation。  
> 结论：**方向正确。主 UI 现在能看见插排，但不是 Marketplace。** Extensions → Plugins 展示 Host 默认 off + Claude / Notes 两个已声明插头。侧栏「市场」仍 disabled。未激活、未删 `engine/claude*`、未迁 `note_cards`。

## 证明

- `plugin_rack`：3 passed
- `plugin_runtime::boot`：11 passed
- vitest Extensions / PluginRack / Sidebar / layout：80 passed
- `openspec validate plugin-rack-readonly-surface --strict --no-interactive`

## 怎么看

侧栏 **拓展** → **Plugins**。应看到 Host 默认关闭，以及 `com.mossx.engine.claude` / `com.mossx.notes` 空闲。侧栏 **市场** 仍灰。

## 下一刀

产品级 Claude disable-not-delete 仍不删代码；或把更多已声明插头写进只读清单。禁止从此处做 Marketplace 安装。
