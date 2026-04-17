## ADDED Requirements

### Requirement: SOLO Follow Entry MUST Be Self-Explanatory
`session activity` 区域中的 `SOLO` 跟随入口 MUST 具备可见语义，帮助首次用户在不依赖图标记忆的情况下理解该能力用途。

#### Scenario: entry renders icon label and tooltip as a combined affordance
- **WHEN** 用户打开 `session activity` 面板
- **THEN** `SOLO` 跟随入口 MUST 同时呈现 icon 与可见文本标签
- **AND** 入口 MUST 提供可读 tooltip，明确“开启后将实时打开 AI 正在修改的文件”
- **AND** 入口 MUST 提供可访问名称，支持键盘焦点与读屏识别

#### Scenario: discoverability enhancement does not auto-enable follow
- **WHEN** 用户仅看到入口文案、tooltip 或其他引导提示
- **THEN** 系统 MUST NOT 自动开启 `SOLO` 跟随
- **AND** 系统 MUST NOT 自动抢占 editor 焦点

### Requirement: SOLO Follow Onboarding MUST Support One-Time Guided Discovery
系统 MUST 为首次进入 `session activity` 的用户提供一次性引导，明确 `SOLO` 跟随能力位置与作用。

#### Scenario: first-time coach mark appears once per user workspace context
- **WHEN** 用户首次进入某 workspace 的 `session activity`
- **THEN** 系统 MUST 展示指向 `SOLO` 跟随入口的一次性 `coach mark`
- **AND** 用户关闭后，系统 MUST 记录已读状态并在同用户同 workspace 不重复弹出

#### Scenario: reopening panel after dismissal does not re-trigger onboarding
- **WHEN** 用户已关闭该 workspace 的首次引导后再次打开 `session activity`
- **THEN** 系统 MUST NOT 再次展示该首次 `coach mark`

### Requirement: SOLO Follow Nudge MUST Trigger On File-Change Context With Frequency Guard
当用户尚未开启 `SOLO` 跟随且 AI 产生日志中的文件修改事件时，系统 MUST 提供情境提示，并通过频控避免过度打扰。

#### Scenario: contextual toast appears on first file-change while follow is off
- **WHEN** 当前会话出现新的 `file-change` 事件且 `SOLO` 跟随未开启
- **THEN** 系统 MUST 展示情境 toast 提示用户开启实时跟随
- **AND** toast MUST 提供 `开启` 与 `稍后` 两个动作

#### Scenario: choosing later suppresses repeated nudge in same turn
- **WHEN** 用户在当前轮次点击 toast 的 `稍后`
- **THEN** 系统 MUST 在该轮次内抑制重复 toast
- **AND** 仅在后续出现新轮次 `file-change` 时，系统才可再次提示

#### Scenario: clicking enable activates follow without dropping current session context
- **WHEN** 用户点击 toast 的 `开启`
- **THEN** 系统 MUST 切换到 `SOLO` 跟随开启状态
- **AND** 后续 `file-change` 事件 MUST 进入实时跟随打开链路
- **AND** 切换行为 MUST 保持当前会话上下文，不得导致 timeline 数据重置

### Requirement: SOLO Follow Chain Actions MUST Remain Recoverable
系统 MUST 支持在同一管理会话中连续执行“提示 -> 开启/稍后 -> 再次提示/重试开启”操作链，并保证失败可恢复。

#### Scenario: follow can be re-enabled after manual disable in later file-change round
- **WHEN** 用户手动关闭 `SOLO` 跟随后，后续再次出现新轮次 `file-change`
- **THEN** 系统 MUST 按频控规则重新允许情境提示
- **AND** 用户 MUST 可再次开启 `SOLO` 跟随

#### Scenario: enable failure keeps interface stable and allows retry
- **WHEN** 用户触发 `开启` 但跟随状态切换失败
- **THEN** 系统 MUST 展示可恢复错误反馈
- **AND** 系统 MUST 保持当前视图稳定，不得出现焦点跳闪或面板崩溃
- **AND** 用户 MUST 可在同会话直接重试开启

#### Scenario: consecutive file-change events do not cause duplicate-open jitter
- **WHEN** `SOLO` 跟随已开启且 AI 在短时间内连续产生多个 `file-change` 事件
- **THEN** 系统 MUST 按事件顺序更新跟随目标
- **AND** 系统 MUST NOT 因重复事件导致同一文件的可见重复打开抖动
