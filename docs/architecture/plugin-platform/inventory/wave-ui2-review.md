# Wave UI-2 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-rack-market-sibling`  
> 论文对齐：展示不是 activation；市场入口不是 Marketplace 安装。  
> 结论：**位置已纠正。只读插排与拓展同级，入口是侧栏「市场」。** 拓展 → Plugins 恢复空壳。未激活、未安装、未删 `engine/claude*`、未迁 `note_cards`。

## 证明

- `openspec validate plugin-rack-market-sibling --strict --no-interactive`
- Sidebar / Extensions / PluginRack / mode / ownership / CSS：本刀相关用例通过
- DesktopLayout 既有 `horizontal editor split` composer parent 断言在本刀前已失败，未纳入本刀验收

## 怎么看

侧栏 **市场** 与 **拓展** 同级。点「市场」应看到 Host 默认关闭，以及 `com.mossx.engine.claude` / `com.mossx.notes` 空闲。点「拓展 → Plugins」仍是空壳。页面没有安装 / 启用按钮。

## 下一刀

产品级 Claude disable-not-delete 仍不删代码；或把更多已声明插头写进只读清单。禁止从此处做 Marketplace 安装。
