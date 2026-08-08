## Purpose

Shared Session（含 multi-agent 协作）下，Composer 输入框上方 Run Status Strip 必须能汇总会话内文件编辑与子代理活动。

## ADDED Requirements

### Requirement: Run status strip SHALL use a composed item source on Shared

系统 MUST 为 Composer run-status 派生使用合成 conversation items，而不仅依赖可能为空的根 props items。

#### Scenario: shared main timeline has edit tools

- **WHEN** 当前 Shared 主时间线 items 含 edit/fileChange 工具且产生正增删
- **THEN** strip MUST 显示已编辑 pill 并可展开文件列表

#### Scenario: collab edits only on agent-canvas

- **WHEN** 协作 worker 仅在 `agent-canvas:{sharedThreadId}:*` 写入 fileChange/edit 工具
- **AND** 主 shared 时间线无对应工具项
- **THEN** strip 的已编辑汇总 MUST 仍包含这些路径（fan-in canvas items）

#### Scenario: no activity keeps strip hidden

- **WHEN** 合成源中无 todo、subagent、plan、edit 活动
- **THEN** strip MUST NOT 占位展示空 chrome（与现 `useComposerRunStatus.visible` 一致）

### Requirement: Revert actions SHALL remain git-restore based

系统 MUST 继续通过既有 `onRevertFile` / `onRevertAllFiles`（git restore）执行撤销，不得发明第二套 revert 协议。

#### Scenario: revert all uses listed paths

- **WHEN** 用户在已编辑面板确认撤销全部
- **THEN** 回调 MUST 收到当前汇总中的路径列表
