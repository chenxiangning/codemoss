# Wave UI-4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-rack-declared-cli-plugs`  
> 论文对齐：inventory 是真相；展示不是 activation。  
> 结论：**方向正确。只读清单补上其余已盘点 CLI。** 市场现在声明 11 个插头：Claude / Notes / Project Map / Browser / Intent Canvas + Codex / Gemini / Grok / Kimi / OpenCode / Pi。全部默认 idle。未激活、未安装、未把已删 CLI 拷回 Core。

## 证明

- `openspec validate plugin-rack-declared-cli-plugs --strict --no-interactive`
- `plugin_rack`：4 passed
- vitest PluginRack / pluginRack fallback：3 passed
- 六个 CLI pluginId 均来自 `ownership.json`

## 怎么看

侧栏 **市场** 应看到 11 个空闲插头。页面仍无安装 / 启用按钮。

## 下一刀

市场只读插排按 Engine / Feature 分组，方便插拔交付阅读。禁止从此处做 Marketplace 安装或产品 disable。
