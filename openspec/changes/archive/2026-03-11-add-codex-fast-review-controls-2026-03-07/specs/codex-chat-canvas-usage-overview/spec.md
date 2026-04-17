## MODIFIED Requirements

### Requirement: Codex-Only Usage Entry in Config Menu

系统 MUST 在 ChatInputBox 配置菜单中提供“实时用量”入口，并且仅在 Codex 引擎下可见；同时，Codex 专属能力入口区域 MUST 与 `Speed`、`Review` 快捷动作保持同域展示与同级可见性约束。

#### Scenario: usage entry appears for codex engine

- **GIVEN** 当前会话引擎为 `codex`
- **WHEN** 用户打开输入区配置菜单
- **THEN** 菜单 MUST 显示“实时用量”入口

#### Scenario: usage entry is hidden for non-codex engine

- **GIVEN** 当前会话引擎为 `claude` / `opencode` / `gemini`
- **WHEN** 用户打开输入区配置菜单
- **THEN** 菜单 MUST NOT 显示“实时用量”入口

#### Scenario: codex capability entries are shown as one region

- **GIVEN** 当前会话引擎为 `codex`
- **WHEN** 用户打开输入区配置菜单
- **THEN** 菜单 MUST 在同一 Codex 能力区域显示“实时用量”、“Speed”、“Review”入口

#### Scenario: codex capability entries remain hidden for non-codex

- **GIVEN** 当前会话引擎为 `claude` / `opencode` / `gemini`
- **WHEN** 用户打开输入区配置菜单
- **THEN** 菜单 MUST NOT 显示“实时用量”、“Speed”、“Review”三个 Codex 专属入口

#### Scenario: non-codex usage behavior is not regressed

- **GIVEN** 当前会话引擎为 `claude` / `opencode` / `gemini`
- **WHEN** 用户进行发送、停止、切换模型等既有输入区操作
- **THEN** 系统 MUST 保持与改动前一致的交互与可用性
- **AND** 本次 Codex 专属能力接入 MUST NOT 引入额外副作用
