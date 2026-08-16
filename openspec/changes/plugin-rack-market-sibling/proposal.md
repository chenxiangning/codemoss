# Proposal: plugin-rack-market-sibling

> OpenSpec change id: `plugin-rack-market-sibling`  
> 依赖：`plugin-rack-readonly-surface`

## Why

只读插排先挂在拓展 → Plugins，位置错了。用户要求它与拓展同级，入口是侧栏「市场」。

## 目标与边界

1. 侧栏「市场」打开独立 `appMode=market`。
2. 市场页展示只读插排。拓展 → Plugins 恢复空壳。
3. MUST NOT 安装、启用、发 Marketplace。
4. MUST NOT 默认开 flag、删 `engine/claude*`、迁 `note_cards`。

## Capabilities

- `plugin-rack-market-sibling-v1`
