# Proposal: plugin-kanban-package-layer

> OpenSpec change id: `plugin-kanban-package-layer`

## Why

看板随后也要成为插件。第一步只在当前仓库分包分层，不迁产品路径，不进 boot，不发 Marketplace。

## 目标与边界

1. 增加 `packages/plugin-kanban` 过渡仓，`pluginId` 为 `com.mossx.kanban`。
2. 产品代码仍留在 `src/features/kanban`。
3. 市场只读插排 MUST 声明该插头，默认 idle。
4. MUST NOT 改 AppShell 产品导入、MUST NOT 迁存储、MUST NOT 远程安装。

## Capabilities

- `plugin-kanban-package-layer-v1`
