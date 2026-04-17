## ADDED Requirements

### Requirement: Vendor Tabs MUST Expose Engine Icons and Gemini Entry

供应商设置页 MUST 在 tab 层展示引擎图标，并提供可访问的 Gemini 配置入口。

#### Scenario: vendor tabs render engine icons

- **WHEN** 用户打开设置页并进入供应商管理
- **THEN** 系统 MUST 在 `Claude Code` 与 `Codex` 与 `Gemini CLI` tab 上展示对应引擎图标
- **AND** tab 标签 MUST 保持可点击切换

#### Scenario: gemini configuration tab remains visible

- **WHEN** 用户在供应商管理中查看可配置引擎
- **THEN** 系统 MUST 显示 `Gemini CLI` tab
- **AND** 点击后 MUST 进入 Gemini 配置面板

### Requirement: Gemini Panel MUST Provide Preflight Checks

Gemini 配置面板 MUST 提供运行环境预检能力，以便用户识别本地依赖是否可用。

#### Scenario: preflight returns three checks

- **WHEN** 用户进入 Gemini 配置面板或点击刷新
- **THEN** 系统 MUST 执行 `Gemini CLI`、`Node.js`、`npm` 三项预检
- **AND** 每项 MUST 返回 `pass/fail` 与可读 message

#### Scenario: preflight failure remains diagnosable

- **WHEN** 任一预检命令执行失败或超时
- **THEN** 系统 MUST 在该项展示 `FAIL` 状态
- **AND** MUST 保留错误信息用于诊断

### Requirement: Gemini Auth Mode MUST Drive Field Visibility and Cleanup

Gemini 认证配置 MUST 使用模式驱动字段显隐，并在模式切换时清理无关字段，避免残留冲突配置。

#### Scenario: auth mode controls input visibility

- **WHEN** 用户选择不同 `auth_mode`
- **THEN** 系统 MUST 按模式显示对应字段（例如 custom 显示 base URL，vertex 模式显示 cloud/project）
- **AND** MUST 隐藏与当前模式无关的输入项

#### Scenario: switching mode clears incompatible values

- **WHEN** 用户从一种模式切换到另一种模式
- **THEN** 系统 MUST 清理与新模式冲突的认证字段值
- **AND** MUST 同步更新环境变量文本

### Requirement: Gemini Environment Mapping MUST Be Deterministic

Gemini 配置 MUST 将关键字段映射到固定环境变量键，并在保存前进行规范化。

#### Scenario: key fields map to canonical env names

- **WHEN** 用户编辑 Gemini 关键字段（API Key、Model、Project、Location 等）
- **THEN** 系统 MUST 映射到固定键（如 `GEMINI_API_KEY`、`GEMINI_MODEL`、`GOOGLE_CLOUD_PROJECT`）
- **AND** MUST 清理 legacy 键（如 `GEMINI_BASE_URL`、`GOOGLE_GEMINI_API_KEY`）

#### Scenario: env text parsing ignores invalid lines

- **WHEN** 用户在环境变量文本中输入空行、注释或无 `=` 的行
- **THEN** 系统 MUST 忽略无效行
- **AND** MUST 保留可解析键值并参与保存

### Requirement: Gemini Settings MUST Persist and Reload Consistently

Gemini 配置保存与回读 MUST 在同一配置源上保持一致，并满足默认启用语义。

#### Scenario: save and reopen keeps same values

- **WHEN** 用户保存环境变量或认证配置后重新进入页面
- **THEN** 系统 MUST 从配置文件回读一致的 `env` 与 `auth_mode`
- **AND** UI MUST 反映最新持久化值

#### Scenario: gemini enabled defaults to true

- **WHEN** 系统首次读取 Gemini 配置或执行 Gemini 配置保存
- **THEN** `enabled` MUST 默认为 `true`
- **AND** 保存行为 MUST 保持 `enabled=true` 语义

### Requirement: Gemini Header Banner MUST Be Hidden Without Affecting Behavior

Gemini 面板顶部视觉 banner 被隐藏后，配置行为 MUST 保持完整可用。

#### Scenario: panel starts with actionable configuration sections

- **WHEN** 用户进入 Gemini 配置面板
- **THEN** 系统 MUST 直接展示预检、环境变量、认证配置区域
- **AND** MUST NOT 因隐藏 banner 影响保存与预检操作

