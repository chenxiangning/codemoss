## ADDED Requirements

### Requirement: Product surfaces MUST follow allowlisted desiredState

Notes、Project Map 与 Claude 的产品入口和面板 MUST 在对应插头 `desiredState === "uninstalled"` 后隐藏。Project Memory MUST 跟随 Project Map。Chat canvas MUST 保留。缺省 presence MUST 为 present，直到读到第一份 rack snapshot。

#### Scenario: uninstalling Notes hides the notes surface

- **WHEN** `com.mossx.notes` 的 `desiredState` 变为 `uninstalled`
- **THEN** 右侧 toolbar、Quick Switcher 与笔记面板 MUST 不再暴露 Notes
- **AND** 打开 Notes 的 shortcut / handler MUST no-op
- **AND** 若当时正停在 notes 表面，shell MUST 回到 chat / files

#### Scenario: uninstalling Project Map hides map and memory

- **WHEN** `com.mossx.project-map` 的 `desiredState` 变为 `uninstalled`
- **THEN** Project Map 与 Project Memory 的入口和面板 MUST 一起隐藏
- **AND** 若当时正停在 projectMap / memory 表面，shell MUST 回到 chat / files

#### Scenario: uninstalling Claude hides the Claude engine entry

- **WHEN** `com.mossx.engine.claude` 的 `desiredState` 变为 `uninstalled`
- **THEN** EngineSelector 的可用引擎列表 MUST 不再包含 `claude`
- **AND** 若 `activeEngine` 当时是 `claude`，MUST 切到另一台引擎
- **AND** Chat canvas MUST 仍然可见

### Requirement: Uninstalling Claude MUST confirm before interrupting in-flight turns

卸载 `com.mossx.engine.claude` MUST 先弹出 `ConfirmDialog`，说明会打断所有正在进行的 Claude turn 并隐藏 Claude 入口。取消 MUST 不调用 `uninstall_plugin`。确认后 MUST 先写入 lockfile / 停用插头，再调用 `interrupt_all_claude_sessions`。Notes 与 Project Map 的卸载 MUST 保持立即执行。

#### Scenario: cancel keeps Claude installed

- **WHEN** 用户在 Claude listing 点卸载
- **THEN** 页面 MUST 出现确认对话框
- **AND** 在用户取消之前 MUST NOT 调用 `uninstall_plugin`
- **AND** 取消后 Claude listing MUST 仍为已安装

#### Scenario: confirm uninstalls and interrupts

- **WHEN** 用户确认卸载 Claude
- **THEN** 前端 MUST 调用 `uninstall_plugin("com.mossx.engine.claude")`
- **AND** 后端在 lockfile 卸载成功后 MUST 调用 `interrupt_all_claude_sessions`
- **AND** 若运行时没有 `AppState`（浏览器预览），MUST 跳过 interrupt 且 MUST NOT 失败

#### Scenario: Notes uninstall stays immediate

- **WHEN** 用户在 Notes listing 点卸载
- **THEN** 页面 MUST NOT 出现 Claude 卸载确认框
- **AND** 前端 MUST 立即调用 `uninstall_plugin("com.mossx.notes")`
