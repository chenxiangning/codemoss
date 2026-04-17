# file-view-language-rendering-coverage Specification

## Purpose

定义文件预览与编辑链路共享的语言判定契约，持续扩展语言覆盖（含 shell 脚本组）并保障既有渲染能力无回归。
## Requirements
### Requirement: Unified Language Resolution Contract

系统 MUST 使用统一的文件语言判定规则为预览渲染、编辑渲染、结构化预览和安全 fallback 提供一致输入，不得由多套独立映射长期漂移；该规则 MUST 在进入判定前完成平台相关路径归一化。

#### Scenario: same file path resolves consistently for preview and edit pipelines

- **WHEN** 用户在右侧文件树打开任意可文本渲染文件
- **THEN** 系统 MUST 基于统一规则解析该文件的语言类型
- **AND** 预览链路与编辑链路 MUST 共享同一语言判定结果来源

#### Scenario: filename-priority rules are applied before extension fallback

- **WHEN** 打开具有强语义文件名的配置文件（例如 `pom.xml`、`application.properties`）
- **THEN** 系统 MUST 先应用文件名规则
- **AND** 文件名规则未命中时 MUST 回退到扩展名规则

#### Scenario: platform-specific path forms resolve to the same filename rule

- **WHEN** 同一逻辑文件分别以 Windows 风格反斜杠路径、Windows 大小写变体文件名或 macOS 恢复出的绝对路径进入渲染链路
- **THEN** 系统 MUST 先对路径进行统一归一化，再执行文件名优先与扩展名回退规则
- **AND** MUST NOT 因路径分隔符、大小写或绝对/相对路径形态差异得到不同的语言判定结果

#### Scenario: structured preview and fallback decisions use the same resolution source

- **WHEN** 用户打开支持结构化预览或需要安全 fallback 的文件类型
- **THEN** 系统 MUST 通过与预览/编辑相同的统一判定来源决定结构化预览类型与 fallback 语义
- **AND** MUST NOT 额外维护一套与语言映射长期独立演化的文件类型决策表

### Requirement: Java and XML Files Render with Syntax Highlighting

系统 SHALL 为 Java 与 XML 文件在预览与编辑两种模式下提供语法高亮渲染。

#### Scenario: java source is highlighted in preview and edit modes

- **WHEN** 用户打开 `*.java` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Java 语法高亮
- **AND** 编辑模式 MUST 显示 Java 语法高亮

#### Scenario: pom and other xml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `pom.xml` 或任意 `*.xml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 XML 语法高亮
- **AND** 编辑模式 MUST 显示 XML 语法高亮

### Requirement: Python Files Render with Syntax Highlighting

系统 SHALL 为 Python 文件在预览与编辑两种模式下提供语法高亮渲染。

#### Scenario: python source is highlighted in preview and edit modes

- **WHEN** 用户打开 `*.py` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Python 语法高亮
- **AND** 编辑模式 MUST 显示 Python 语法高亮

### Requirement: Spring Configuration Files Render Correctly

系统 SHALL 为 Spring 常见配置文件提供可读且一致的语法渲染。

#### Scenario: spring properties files are highlighted in preview and edit modes

- **WHEN** 用户打开 `application.properties` 或任意 `*.properties` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 Properties 语法高亮
- **AND** 编辑模式 MUST 显示 Properties 语法高亮

#### Scenario: spring yaml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `application.yml`、`application.yaml` 或 `application-*.yml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 YAML 语法高亮
- **AND** 编辑模式 MUST 显示 YAML 语法高亮

### Requirement: SQL, GitIgnore, Lock and TOML Files Render Correctly

系统 SHALL 为 SQL、GitIgnore、Lock 与 TOML 文件提供可读且一致的语法渲染。

#### Scenario: sql files are highlighted in preview and edit modes

- **WHEN** 用户打开 `*.sql` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 SQL 语法高亮
- **AND** 编辑模式 MUST 显示 SQL 语法高亮

#### Scenario: gitignore files are highlighted in preview and edit modes

- **WHEN** 用户打开 `.gitignore` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示可读语法高亮
- **AND** 编辑模式 MUST 显示可读语法高亮

#### Scenario: lock files follow filename-priority language rules

- **WHEN** 用户打开 `*.lock` 文件并在预览/编辑模式间切换
- **THEN** 系统 MUST 先应用文件名优先规则（例如 `cargo.lock`）
- **AND** 文件名规则未命中时 MUST 回退到扩展名规则
- **AND** 预览与编辑模式 MUST 使用同一判定结果来源

#### Scenario: toml files are highlighted in preview and edit modes

- **WHEN** 用户打开 `*.toml` 文件并在预览/编辑模式间切换
- **THEN** 预览模式 MUST 显示 TOML 语法高亮
- **AND** 编辑模式 MUST 显示 TOML 语法高亮

### Requirement: Additive-Only Delivery and Non-Regression Guard

本变更 MUST 采用新增优先策略；既有已支持文件类型的渲染行为不得被破坏或回退，但 Markdown 文件允许按照文件预览专用 renderer 的新契约演进，且主窗口与独立文件窗口 MUST 保持共享渲染基线。

#### Scenario: existing supported non-markdown languages remain unchanged after rollout

- **WHEN** 变更后打开既有支持且非 Markdown 的文件类型（如 `js`、`ts`、`json`、`css`、`yaml`）
- **THEN** 预览与编辑模式的渲染表现 MUST 与变更前基线一致
- **AND** 不得出现由本次扩展引入的高亮缺失或错误语言匹配

#### Scenario: markdown files adopt dedicated file-preview rendering

- **WHEN** 变更后打开 `md` 或 `mdx` 文件并进入文件预览模式
- **THEN** 系统 MUST 允许该预览偏离变更前基于消息 renderer 的 Markdown 视觉基线
- **AND** 该偏离 MUST 仅来自文件预览专用 Markdown renderer 的有意能力拆分
- **AND** Markdown 文件的源码编辑链路 MUST 保持与统一语言判定规则兼容

#### Scenario: unknown file types fall back safely to plain text

- **WHEN** 用户打开未被语言规则覆盖的文件类型
- **THEN** 系统 MUST 回退为纯文本渲染
- **AND** 回退过程 MUST 不触发崩溃、空白渲染或未捕获异常

#### Scenario: main and detached surfaces keep the same rendering baseline

- **WHEN** 用户在主窗口和独立文件窗口分别打开同类文本文件
- **THEN** 两个 surface MUST 使用同一语言判定与 fallback 规则
- **AND** MUST NOT 出现一侧高亮而另一侧错误退化的系统性不一致

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

### Requirement: High-Frequency Languages and Configuration Files Expand Rendering Coverage

系统 SHALL 在本次冻结范围内补齐高频语言与配置文件的渲染覆盖，并优先保证“可读预览 + 可解释编辑能力 + 安全 fallback”的一致结果。

#### Scenario: popular web and application source files no longer fall back blindly

- **WHEN** 用户打开高频但原先缺失或不完整支持的源码文件类型（例如 `vue`、`php`、`rb`、`cs`、`dart`）
- **THEN** 系统 MUST 为这些文件提供明确的渲染策略
- **AND** 该策略 MUST 至少在预览、编辑或 fallback 三者之一中表现为一致、可解释的结果

#### Scenario: high-frequency configuration files resolve with explicit strategy

- **WHEN** 用户打开高频配置文件类型（例如 `gradle`、`kts`、`ini`、`conf`、`.env`、`docker-compose.yml`）
- **THEN** 系统 MUST 为这些文件提供明确的语言渲染或结构化预览策略
- **AND** MUST NOT 将其长期保留为无语义的隐式纯文本处理

#### Scenario: comment-aware config editors use lightweight syntax modes when already available

- **WHEN** 用户在编辑模式打开高频配置文件，且仓库内已存在可复用的轻量语法模式（例如 `.env`/`ini`/`conf` 的 `#` 注释，`gradle`/`kts` 的 `//` 注释）
- **THEN** 系统 MUST 优先复用这些轻量模式提供注释和基础 key/value 或脚本结构着色
- **AND** MUST NOT 在已有低风险模式可用时仍一律退化为无注释高亮的纯文本编辑

