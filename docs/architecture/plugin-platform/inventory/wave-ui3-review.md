# Wave UI-3 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-rack-declared-later-plugs`  
> 论文对齐：config / inventory 是真相；展示不是 activation。  
> 结论：**方向正确。只读清单补上路线图下一组已盘点插头。** 市场现在声明 Claude、Notes、Project Map、Browser、Intent Canvas。全部默认 idle。未激活、未安装、未删 `engine/claude*`、未迁 `note_cards`。

## 证明

- `openspec validate plugin-rack-declared-later-plugs --strict --no-interactive`
- `plugin_rack`：4 passed
- vitest PluginRack / pluginRack fallback：3 passed
- 三个新 pluginId 均来自 `ownership.json`，测试锁住不得发明身份

## 怎么看

侧栏 **市场** 应看到五个空闲插头。页面仍无安装 / 启用按钮。

## 下一刀

只读清单补其余已盘点 CLI（Codex / Gemini / Grok / Kimi / OpenCode / Pi）。禁止从此处做 Marketplace 安装或产品 disable。
