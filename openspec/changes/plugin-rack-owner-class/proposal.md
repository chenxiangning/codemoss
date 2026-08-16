# Proposal: plugin-rack-owner-class

> OpenSpec change id: `plugin-rack-owner-class`  
> 依赖：`plugin-rack-kind-groups`

## Why

市场只读卡片现在只显示 kind / state。用户看不出哪些是当前 pilot，哪些只是后续盘点身份。本刀把 inventory `ownerClass` 写进只读快照。

## 目标与边界

1. Claude / Notes 标 `pilot`，其余已声明插头标 `later-plugin`。
2. 分类必须与 ownership inventory 一致。
3. MUST NOT 激活、disable、安装。
4. MUST NOT 默认开 flag、删 `engine/claude*`、迁 `note_cards`。

## Capabilities

- `plugin-rack-owner-class-v1`
