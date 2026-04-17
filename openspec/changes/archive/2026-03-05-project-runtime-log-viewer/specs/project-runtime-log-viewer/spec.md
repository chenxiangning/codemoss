# project-runtime-log-viewer Specification

ADDED by change: project-runtime-log-viewer

## Purpose

定义 CodeMoss 在工作区内执行多技术栈项目（Java/Node/Python/Go）并查看实时日志的规范契约，确保可观测、可停止、可隔离，且对现有文件树能力零回退。

## ADDED Requirements

### Requirement: Run Trigger Entry in File Tree

系统 MUST 在文件树搜索行右侧提供可见的 Run 触发入口，并将其作为项目运行日志能力的统一入口。

#### Scenario: user toggles runtime console from file tree entry

- **WHEN** 用户点击文件树搜索行右侧 Run icon
- **THEN** 系统 MUST 切换 Run Console 显隐状态（打开/折叠）
- **AND** 不得自动触发文件打开行为

#### Scenario: run entry keeps existing file-tree interactions intact

- **WHEN** 用户使用文件树的搜索、文件点击、预览等既有功能
- **THEN** 既有行为 MUST 与变更前保持一致
- **AND** Run 入口接入 MUST 不改变原有交互语义

### Requirement: Console and Terminal Panel Mutual Exclusion

系统 MUST 保证 Run Console 与 Terminal 面板互斥显示，避免双面板并行展开。

#### Scenario: opening runtime console closes terminal panel

- **WHEN** 用户打开 Run Console 且 Terminal 当前为展开
- **THEN** 系统 MUST 自动关闭 Terminal
- **AND** Run Console MUST 成为唯一底部展开面板

#### Scenario: opening terminal panel closes runtime console

- **WHEN** 用户打开 Terminal 且 Run Console 当前为展开
- **THEN** 系统 MUST 自动关闭 Run Console
- **AND** Terminal MUST 成为唯一底部展开面板

### Requirement: Runtime Profile Auto Detection

系统 MUST 基于工作区内容探测可用 runtime profile，并用于生成默认运行命令。

#### Scenario: frontend workspace yields node profiles

- **WHEN** 工作区存在 `package.json` 且包含 `scripts.dev` 或 `scripts.start`
- **THEN** 系统 MUST 生成 `node-dev` / `node-start` profile
- **AND** profile MUST 包含对应默认命令模板

#### Scenario: python workspace yields python profile

- **WHEN** 工作区存在 `main.py` / `app.py` / `manage.py` / `pyproject.toml` 等 Python 线索
- **THEN** 系统 MUST 生成 `python-main` profile
- **AND** profile MUST 提供可执行默认命令或可编辑提示

#### Scenario: go workspace yields go profile

- **WHEN** 工作区存在 `go.mod` 或 `main.go`
- **THEN** 系统 MUST 生成 `go-run` profile
- **AND** profile MUST 默认支持 `go run .` 路径

### Requirement: Java Runtime Preflight Validation

系统 MUST 在 Java profile 启动前执行运行环境与构建工具探测，并返回结构化可读结果。

#### Scenario: wrapper-first startup command resolution

- **WHEN** 工作区存在 Java 项目标识文件（如 `pom.xml` 或 `build.gradle`）
- **THEN** 系统 MUST 按 wrapper 优先策略解析启动命令
- **AND** wrapper 不存在时 MUST 回退到系统命令

#### Scenario: missing runtime dependency is reported explicitly

- **WHEN** 本机缺少 Java 或必要构建工具
- **THEN** 系统 MUST 返回明确错误原因与可执行提示
- **AND** 不得静默失败

### Requirement: Configurable Runtime Command Selection

系统 MUST 提供“预设命令下拉 + 可编辑命令输入”机制，支持用户在执行前覆写默认启动命令。

#### Scenario: preset selection pre-fills editable command input

- **WHEN** 用户在 Run Console 中选择任意 runtime profile 预设
- **THEN** 系统 MUST 自动填充对应命令文本
- **AND** 用户 MUST 仍可继续编辑该命令

#### Scenario: empty input falls back to profile default resolution

- **WHEN** 命令输入为空且用户点击 Run
- **THEN** 系统 MUST 使用当前 profile 的默认解析逻辑
- **AND** 命令预览 MUST 显示实际执行命令

#### Scenario: custom command override takes precedence

- **WHEN** 用户输入自定义命令并点击 Run
- **THEN** 系统 MUST 优先执行该自定义命令
- **AND** 运行状态、日志流和退出码展示 MUST 与默认命令路径保持一致

### Requirement: Workspace-Scoped Runtime Session Lifecycle

系统 SHALL 以工作区为隔离边界管理运行会话，并维护可追踪状态机。

#### Scenario: runtime state transitions are observable

- **WHEN** 会话经历启动、运行、停止或失败过程
- **THEN** 系统 MUST 对外发布状态变化（至少包含 `starting/running/stopped/failed`）
- **AND** 状态变化 MUST 可被前端一致消费

#### Scenario: stop action terminates active runtime process

- **WHEN** 用户在运行中点击 Stop
- **THEN** 系统 MUST 终止对应工作区的活动进程
- **AND** 会话状态 MUST 变为 `stopped` 或 `failed`（含退出原因）

### Requirement: Streaming Runtime Log Console

系统 SHALL 以实时流方式展示运行日志，覆盖 stdout 与 stderr。

#### Scenario: runtime logs stream incrementally

- **WHEN** 项目启动后产生输出
- **THEN** 日志 MUST 以增量方式持续写入控制台
- **AND** 不得仅在进程结束后一次性展示

#### Scenario: log events include source and timing metadata

- **WHEN** 任意日志行被推送到前端
- **THEN** 每条日志 MUST 至少包含时间信息与来源标识（stdout/stderr）
- **AND** 前端 MUST 按接收顺序稳定渲染

### Requirement: Console Controls and Safety Limits

系统 MUST 提供基础日志控制能力，并保障长时间运行时的稳定性。

#### Scenario: clear and copy actions are available

- **WHEN** 用户在 Run Console 中执行 Clear 或 Copy
- **THEN** 系统 MUST 完成对应日志视图操作
- **AND** 该操作 MUST 不影响运行进程本身

#### Scenario: console applies bounded buffer strategy

- **WHEN** 日志体量持续增长到设定阈值
- **THEN** 系统 MUST 启用有界缓冲策略防止内存无限增长
- **AND** 缓冲截断行为 MUST 对用户可见

### Requirement: Workspace Isolation and Non-Regression

系统 MUST 保证运行日志会话在工作区之间隔离，并遵循新增优先原则避免回退。

#### Scenario: runtime logs do not leak across workspaces

- **WHEN** 用户在多个工作区切换并分别触发运行
- **THEN** 每个工作区 MUST 只显示自身会话日志与状态
- **AND** 不得出现跨工作区日志串流

#### Scenario: additive-only delivery preserves legacy behavior

- **WHEN** 新功能启用后执行现有文件树主流程
- **THEN** 现有能力 MUST 保持兼容且无破坏性变更
- **AND** 回归测试 MUST 覆盖该兼容性要求
