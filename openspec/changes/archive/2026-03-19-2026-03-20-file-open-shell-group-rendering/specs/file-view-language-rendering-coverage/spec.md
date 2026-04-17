## ADDED Requirements

### Requirement: Shell Script Group Files Render with Unified Compatibility Rules

系统 SHALL 为 shell 脚本组文件在预览与编辑两种模式下提供一致语法渲染，并复用统一语言判定来源。

#### Scenario: shell extension group resolves to bash/shell in preview and edit

- **WHEN** 用户打开 `*.sh`、`*.bash`、`*.zsh`、`*.ksh`、`*.dash`、`*.command` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 使用 `bash` 渲染语义
- **AND** 编辑模式 MUST 使用 `shell` 渲染语义
- **AND** 两种模式 MUST 共享同一语言判定结果来源

#### Scenario: shell dotfile names follow filename-priority compatibility rules

- **WHEN** 用户打开 `.envrc`、`envrc`、`.bashrc`、`bashrc`、`.zshrc`、`zshrc`、`.kshrc`、`kshrc`、`.profile`、`profile`
- **THEN** 系统 MUST 优先命中文件名规则并按 shell 语义渲染
- **AND** 文件名规则命中结果 MUST 高于扩展名回退规则

#### Scenario: dockerfile compatibility remains stable after shell group expansion

- **WHEN** 用户打开 `Dockerfile` 或 `Dockerfile.*` 文件
- **THEN** 系统 MUST 保持既有 Dockerfile 渲染契约
- **AND** shell 脚本组扩展 MUST NOT 覆盖 Dockerfile 的识别结果

#### Scenario: boundary inputs safely fall back without crash

- **WHEN** 用户打开空路径、无文件名、未知扩展名或尾随点文件名（如 `script.`）
- **THEN** 系统 MUST 回退为纯文本渲染
- **AND** 回退过程 MUST 不触发崩溃、空白渲染或未捕获异常
