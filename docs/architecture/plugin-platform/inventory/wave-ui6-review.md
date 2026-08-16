# Wave UI-6 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-rack-owner-class`  
> 论文对齐：inventory 是真相；展示不是 activation。  
> 结论：**方向正确。只读卡片现在能看见 pilot / later-plugin。** Claude / Notes 是试点，其余 9 个是后续插件。全部仍 idle。未安装、未启用、未删 `engine/claude*`、未迁 `note_cards`。

## 证明

- `openspec validate plugin-rack-owner-class --strict --no-interactive`
- `plugin_rack`：4 passed
- vitest PluginRack / pluginRack fallback：3 passed

## 怎么看

侧栏 **市场** 每张卡片多一行分类：试点或后续插件。没有安装 / 启用按钮。

## 下一刀

产品级 Claude disable-not-delete 仍不删代码。禁止从此处做 Marketplace 安装。
