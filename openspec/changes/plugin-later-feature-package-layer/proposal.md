# Proposal: plugin-later-feature-package-layer

> OpenSpec change id: `plugin-later-feature-package-layer`

## Why

市场已声明 Project Map / Browser / Intent Canvas。第一步只在当前仓库分包分层，不迁产品路径，不进 boot。

## 目标与边界

1. 增加三个过渡仓：`com.mossx.project-map`、`com.mossx.browser`、`com.mossx.intent-canvas`。
2. 产品实现仍留 `src/features/project-map`、`src/features/browser-agent`、`src/features/intent-canvas`。
3. 本地目录 MUST 列出这三个包，全部 `installed=false`。
4. MUST NOT 远程安装、MUST NOT 进 boot、MUST NOT 改 AppShell 产品导入。

## Capabilities

- `plugin-later-feature-package-layer-v1`
