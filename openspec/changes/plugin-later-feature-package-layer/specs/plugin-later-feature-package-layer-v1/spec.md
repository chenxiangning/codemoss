# plugin-later-feature-package-layer-v1 Spec Delta

## ADDED Requirements

### Requirement: later market Features MUST have in-repo package layers without leaving Core

仓库 MUST 提供 `packages/plugin-project-map`、`packages/plugin-browser`、`packages/plugin-intent-canvas`。产品实现 MUST 仍在对应 `src/features/**`。boot MUST NOT 安装这些包。

#### Scenario: local catalog lists the three later feature packages as not installed

- **WHEN** 读取本地目录
- **THEN** 目录 MUST 包含 `com.mossx.project-map`、`com.mossx.browser`、`com.mossx.intent-canvas`
- **AND** 三项 MUST `installed=false`
