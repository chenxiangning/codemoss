# codex-rewind-review-surface Specification Delta

## ADDED Requirements

### Requirement: Compact Review Surface For Codex Rewind

Codex rewind 确认流程 MUST 使用紧凑文件审查结构，避免受影响文件区域随文件数线性撑高主体内容。

#### Scenario: rewind entry is only available for supported codex sessions
- **WHEN** 当前会话引擎为 `codex` 且存在可回溯目标
- **THEN** 系统 MUST 显示 rewind 入口并允许进入确认流程
- **AND** 非 `codex` / `claude` 引擎 MUST NOT 因本能力接入而误显示 rewind 入口

#### Scenario: affected files remain independently scrollable
- **WHEN** Codex rewind preview 包含多个受影响文件
- **THEN** 文件列表 SHALL 使用独立滚动区域
- **AND** 目标信息与影响摘要 SHALL 保持可见，不被长文件列表挤出主要视口

#### Scenario: first file is focused by default
- **WHEN** Codex rewind preview 至少包含一个受影响文件
- **THEN** 系统 SHALL 默认选中第一条文件
- **AND** 右侧区域 SHALL 展示该文件的 diff 预览或空态

### Requirement: Codex Rewind File Diff Preview And Navigation

Codex rewind 确认弹层 MUST 支持单文件 diff 预览，并在同一确认流程内查看完整 diff。

#### Scenario: click file switches preview
- **WHEN** 用户点击某个受影响文件
- **THEN** 弹层 SHALL 切换当前选中文件
- **AND** diff 预览区域 SHALL 更新为该文件内容

#### Scenario: file can open full diff overlay
- **WHEN** 用户在 Codex rewind review surface 上触发“查看完整 diff”
- **THEN** 系统 SHALL 在当前确认流程内打开完整 diff overlay
- **AND** overlay SHALL 展示当前选中文件的完整 diff 内容或原始 diff 文本

#### Scenario: missing diff is recoverable
- **WHEN** 当前文件没有可解析 diff
- **THEN** 弹层 SHALL 显示可恢复空态说明
- **AND** rewind 确认与文件切换交互 MUST 保持可用

### Requirement: Codex Rewind File Export Uses Default Chat Diff Directory

Codex rewind 确认弹层 MUST 支持将受影响文件导出到默认全局 chat diff 目录，并复用共享导出协议。

#### Scenario: export writes files into codex engine folder
- **WHEN** 用户点击“存储变更”
- **THEN** 系统 SHALL 将文件写入 `~/.ccgui/chat-diff/codex/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/files/`
- **AND** 同级目录 SHALL 生成 `manifest.json`

#### Scenario: manifest preserves codex rewind metadata
- **WHEN** 导出成功
- **THEN** `manifest.json` SHALL 记录 `conversationLabel`、`workspaceRoot`、`fileCount`
- **AND** 每个导出文件 SHALL 记录 `sourcePath` 与 `storedPath`

#### Scenario: repeated export replaces same rewind snapshot
- **WHEN** 用户对同一 `sessionId + targetMessageId` 重复执行“存储变更”
- **THEN** 系统 SHALL 复用同一个导出根目录
- **AND** 新导出 SHALL 替换旧快照内容

#### Scenario: export failure does not block codex rewind review surface
- **WHEN** 文件导出失败
- **THEN** 系统 SHALL 向用户展示可恢复错误信息
- **AND** Codex rewind 确认弹层 MUST 继续允许切换文件、查看 diff 与取消/确认回溯

### Requirement: Codex Rewind Execution Safety MUST Match Validated Restore Rules

Codex rewind 在执行会话回溯前后 MUST 保持工作区恢复语义一致，并覆盖无 diff 与失败回滚边界。

#### Scenario: missing inline diff still restores via kind or structured fields
- **WHEN** 文件变更条目缺少 inline diff
- **AND** 条目仍可提供可判定 kind 或 structured `old_string/new_string`
- **THEN** 系统 MUST 继续执行文件恢复，而不是直接跳过
- **AND** 恢复结果 SHALL 可预测且可回归验证

#### Scenario: specific kind wins over generic modified
- **WHEN** 同一路径的变更来源同时出现 `modified` 与更具体 kind（`add/delete/rename`）
- **THEN** 系统 MUST 优先采用更具体 kind 作为恢复语义
- **AND** 不得因为 generic kind 覆盖而产生错误恢复结果

#### Scenario: rewind fork failure rolls workspace snapshots back
- **WHEN** 工作区恢复已应用但会话 rewind/fork 失败
- **THEN** 系统 MUST 自动恢复回溯前快照
- **AND** 用户侧不得残留半回溯状态文件

#### Scenario: first user anchor avoids meaningless fork session
- **WHEN** 回溯目标命中会话首条 user message
- **THEN** 系统 MUST 执行首条锚点专用生命周期策略
- **AND** 不得生成无意义 fork 线程
