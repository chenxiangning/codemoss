# Proposal: plugin-rack-kind-groups

> OpenSpec change id: `plugin-rack-kind-groups`  
> 依赖：`plugin-rack-declared-cli-plugs`

## Why

市场只读插排已有 11 个插头。平铺不利于阅读插拔交付。本刀只按 kind 分组展示。

## 目标与边界

1. 市场页按 Engine / Feature 分组。
2. 仍只读。MUST NOT 安装、启用、远程目录。
3. MUST NOT 默认开 flag、删 `engine/claude*`、迁 `note_cards`。

## Capabilities

- `plugin-rack-kind-groups-v1`
