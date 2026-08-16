# Proposal: plugin-remaining-later-package-layer

> OpenSpec change id: `plugin-remaining-later-package-layer`

## Why

inventory 里其余 later-plugin 还没有仓库内过渡仓。第一步只分包分层，不进 Host 插排，不迁产品路径。

## 目标与边界

1. 为尚未分层的 later-plugin 增加 `packages/plugin-*` 过渡仓。
2. 本地目录 MUST 列出这些包，全部 `installed=false`。
3. Host 只读插排 MUST 仍只声明原 12 个插头，不得发明新 activation id。
4. MUST NOT 进 boot、MUST NOT 远程安装、MUST NOT 改 AppShell 产品导入。

## Capabilities

- `plugin-remaining-later-package-layer-v1`
