# Proposal: plugin-local-stage-v1

> OpenSpec change id: `plugin-local-stage-v1`

## Why

市场安装/卸载的第一步已经完成仓库内分包。现在需要让市场页能标记本地过渡仓的 staged / unstaged，证明插拔 UI 走安装预览，而不是激活 Host。

## 目标与边界

1. 市场本地目录 MUST 提供 stage / unstage。
2. stage MUST 先走 `previewInstall`，MUST NOT 读 entry 文件、MUST NOT spawn、MUST NOT 调 `activate_plugin`。
3. staged 只表示本地安装态，不改变 Host 插排 idle。
4. MUST NOT 远程下载、MUST NOT 默认开 flag、MUST NOT 删 `engine/claude*`、MUST NOT 迁 `note_cards`。

## Capabilities

- `plugin-local-stage-v1`
