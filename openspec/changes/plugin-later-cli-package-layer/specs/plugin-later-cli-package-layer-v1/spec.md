# plugin-later-cli-package-layer-v1 Spec Delta

## ADDED Requirements

### Requirement: later market CLIs MUST have in-repo package layers without leaving Core

仓库 MUST 为 Codex / Gemini / Grok / Kimi / OpenCode / Pi 提供过渡仓。产品 engine 实现 MUST 仍在 Core。boot MUST NOT 安装这些包。过渡仓 MUST NOT 包含真实 `bin/`。

#### Scenario: local catalog lists later CLI packages as not installed

- **WHEN** 读取本地目录
- **THEN** 目录 MUST 包含 `com.mossx.engine.codex` 等六个 CLI
- **AND** 各项 MUST `installed=false`
