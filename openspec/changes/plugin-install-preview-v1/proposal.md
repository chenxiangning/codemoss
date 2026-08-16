# Proposal: plugin-install-preview-v1

> OpenSpec change id: `plugin-install-preview-v1`

## Why

合同收口还缺 P0.7 注册信封与 P0.8 安装前无代码执行。没有这两道闸门，市场安装会在审计前加载入口。

## 目标与边界

1. 安装预览只读 Manifest metadata，MUST NOT 读 `path` / `platforms` 文件，MUST NOT spawn。
2. Runtime 注册 MUST 只能声明 Manifest 已有的 contribution / capability。
3. `pluginId + version` 哈希冲突仍 fail closed。
4. MUST NOT 接 boot、MUST NOT 远程安装、MUST NOT 删 `engine/claude*`、MUST NOT 迁 `note_cards`。

## Capabilities

- `plugin-install-preview-v1`
