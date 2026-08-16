# Proposal: plugin-market-builtin-catalog

> OpenSpec change id: `plugin-market-builtin-catalog`  
> 依赖：`plugin-rack-market-sibling`、`plugin-rack-declared-later-plugs`

## Why

市场入口此前只是「只读插排」，用户验收反馈三点：

1. 打开插件市场看不到「内置插件」的清晰清单与用途，一堆裸 pluginId 不知道什么意思。
2. 没有安装状态与安装 / 卸载操作，无法闭环「看到状态 → 卸载 → 重装」。
3. i18n 文案混乱（「本地过渡仓 / Host 插排 / 市场关闭」等术语混杂，8 种语言缺 `extensions.rack` 段直接显示原始 key）。

## 目标与边界

1. 市场页展示**内置插件目录**：45 个 `@mossx/plugin-*` 包，按 `engine / feature` 分类展示，带分类计数。
2. 每个插件卡片展示：displayName、中文描述、pluginId、ownerClass 徽章、安装状态、版本、权限预览。
3. 支持**安装 / 卸载**：点击按钮写本地 lockfile（localStorage `ccgui.pluginLocalStage.v1`），状态即时刷新；卸载后同一卡片可重新安装。
4. i18n 清理：10 种语言补齐 `extensions.rack.*` 段；术语统一为「插件市场 / 内置插件 / 安装 / 卸载」。
5. MUST NOT 激活 Host 运行时（本地标记仅过渡仓语义，与 `pluginLocalStage` 契约一致）。
6. MUST NOT 实现远程 Marketplace 拉取 / 上架（远程市场仍为占位文案）。

## Capabilities

- `plugin-market-builtin-catalog-v1`
