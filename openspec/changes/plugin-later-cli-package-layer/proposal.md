# Proposal: plugin-later-cli-package-layer

> OpenSpec change id: `plugin-later-cli-package-layer`

## Why

市场已声明其余 CLI。第一步只在当前仓库分包分层，不迁 Core engine，不进 boot。

## 目标与边界

1. 为 Codex / Gemini / Grok / Kimi / OpenCode / Pi 增加过渡仓。
2. 产品实现仍留 `src-tauri/src/engine/**`。
3. 本地目录 MUST 列出这些包，全部 `installed=false`。
4. MUST NOT 添加 `bin/`、MUST NOT 远程安装、MUST NOT 进 boot。

## Capabilities

- `plugin-later-cli-package-layer-v1`
