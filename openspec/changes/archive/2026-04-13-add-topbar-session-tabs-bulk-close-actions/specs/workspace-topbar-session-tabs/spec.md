# workspace-topbar-session-tabs Specification Delta

## MODIFIED Requirements

### Requirement: Topbar Tab MUST Provide Close Action Without Lifecycle Side Effects

系统 MUST 将 topbar tab 的关闭能力定义为“窗口管理”，而不是 thread 生命周期操作。

#### Scenario: single close still removes tab from topbar window only

- **WHEN** 用户点击 tab 的 `X`
- **THEN** 该 tab MUST 从 topbar 窗口移除
- **AND** 系统 MUST NOT 删除 thread
- **AND** 系统 MUST NOT 终止会话运行

#### Scenario: close all removes every visible topbar tab only

- **WHEN** 用户在某个 topbar tab 上触发 `关闭全部标签`
- **THEN** 当前 topbar 窗口中的所有 tab MUST 被移除
- **AND** 系统 MUST NOT 删除任何 thread
- **AND** 系统 MUST NOT 终止任何会话运行

#### Scenario: close completed removes only non-processing visible tabs

- **WHEN** 用户触发 `关闭全部已完成标签`
- **THEN** 系统 MUST 仅移除当前 topbar 窗口中 `isProcessing = false` 的 tab
- **AND** `isProcessing = true` 的 tab MUST 被保留
- **AND** `isProcessing` 状态未知（缺失/未初始化）的 tab MUST 被保留
- **AND** 该动作 MUST NOT 删除 thread 或终止会话运行

#### Scenario: close left removes only tabs left of the target tab

- **GIVEN** topbar 窗口中存在位于目标 tab 左侧的可见 tabs
- **WHEN** 用户触发 `关闭左侧标签`
- **THEN** 系统 MUST 仅移除目标 tab 左侧的可见 tabs
- **AND** 目标 tab 与其右侧 tabs MUST 保留

#### Scenario: close right removes only tabs right of the target tab

- **GIVEN** topbar 窗口中存在位于目标 tab 右侧的可见 tabs
- **WHEN** 用户触发 `关闭右侧标签`
- **THEN** 系统 MUST 仅移除目标 tab 右侧的可见 tabs
- **AND** 目标 tab 与其左侧 tabs MUST 保留

#### Scenario: active close falls back to adjacent remaining tab

- **GIVEN** 当前 active tab 被单个关闭或批量关闭动作移出 topbar 窗口
- **WHEN** 关闭后 topbar 窗口仍存在剩余 tabs
- **THEN** 系统 MUST 优先选择关闭前位置右侧最近的剩余 tab
- **AND** 若右侧不存在，则 MUST 选择左侧最近的剩余 tab

#### Scenario: closing active tab with no remaining tabs clears topbar highlight only

- **WHEN** 当前 active tab 被关闭后 topbar 窗口已无剩余 tab
- **THEN** 系统 MUST 清空 topbar 当前高亮
- **AND** MUST NOT 因此删除 thread 或终止会话运行

### Requirement: Topbar Session Tabs SHALL Expose Batch Close Context Menu

系统 MUST 在每个可见 topbar tab 上提供右键上下文菜单，以支持批量关闭动作。

#### Scenario: tab context menu exposes close actions

- **WHEN** 用户在某个 topbar tab 上打开上下文菜单
- **THEN** 菜单 MUST 提供 `关闭标签`、`关闭左侧标签`、`关闭右侧标签`、`关闭全部标签`、`关闭全部已完成标签`

#### Scenario: keyboard context menu trigger is supported on desktop

- **WHEN** 用户在聚焦的 topbar tab 上按下 `ContextMenu` 键或 `Shift+F10`
- **THEN** 系统 MUST 打开与鼠标右键等价的上下文菜单

#### Scenario: unavailable batch actions are disabled

- **WHEN** 目标 tab 左侧没有 tab、右侧没有 tab，或当前窗口没有已完成 tab
- **THEN** 对应批量关闭动作 MUST 以禁用态呈现
- **AND** 系统 MUST NOT 以 silent no-op 方式吞掉该操作
