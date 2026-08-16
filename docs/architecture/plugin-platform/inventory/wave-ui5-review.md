# Wave UI-5 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-rack-kind-groups`  
> 论文对齐：展示不是 activation。  
> 结论：**方向正确。市场只读插排按 Engine / Feature 分组。** 11 个已声明插头仍全部 idle。未安装、未启用、未删 `engine/claude*`、未迁 `note_cards`。

## 证明

- `openspec validate plugin-rack-kind-groups --strict --no-interactive`
- vitest PluginRack / CSS：6 passed

## 怎么看

侧栏 **市场** 先看到 Engines，再看到 Features。没有安装 / 启用按钮。

## 下一刀

产品级 Claude disable-not-delete 仍不删代码。禁止从此处做 Marketplace 安装。
