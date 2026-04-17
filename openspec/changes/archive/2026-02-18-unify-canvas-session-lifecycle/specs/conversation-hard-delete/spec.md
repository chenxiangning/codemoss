## MODIFIED Requirements

### Requirement: 删除成功必须以后端确认为准

系统 MUST 在后端删除成功后才将会话从前端列表移除；不得在后端失败时呈现删除成功。

#### Scenario: hard delete success

- **GIVEN** 用户请求删除某条会话
- **WHEN** 后端返回删除成功
- **THEN** 前端 MUST 移除该会话
- **AND** 删除结果 MUST 标记为 `success=true`

#### Scenario: hard delete failed

- **GIVEN** 用户请求删除某条会话
- **WHEN** 后端返回错误（如 workspace 未连接、会话不存在、IO 失败）
- **THEN** 前端 MUST 保留该会话
- **AND** 删除结果 MUST 返回错误码与错误信息

#### Scenario: no optimistic removal before backend ack

- **GIVEN** 删除请求已发出但后端尚未响应
- **WHEN** UI 更新会话列表
- **THEN** 目标会话 MUST 保持可见
- **AND** MUST NOT 提前显示删除成功

### Requirement: 删除失败必须可观测

系统 MUST 对删除失败提供可见反馈，并携带可分类错误码。

#### Scenario: delete failed with categorized reason

- **GIVEN** 会话删除失败
- **WHEN** UI 处理删除回执
- **THEN** 系统 MUST 显示失败摘要
- **AND** MUST 使用标准错误码集合（`WORKSPACE_NOT_CONNECTED`、`SESSION_NOT_FOUND`、`PERMISSION_DENIED`、`IO_ERROR`、
  `ENGINE_UNSUPPORTED`、`UNKNOWN`）

#### Scenario: unsupported hard-delete path

- **GIVEN** 某引擎当前不支持真实删除后端路径
- **WHEN** 用户执行删除
- **THEN** 系统 MUST 返回 `ENGINE_UNSUPPORTED`
- **AND** 会话 MUST 保持可见

### Requirement: 引擎差异必须收敛到统一删除语义

系统 MUST 对 Claude、Codex、OpenCode 提供统一“删除成功/失败”语义，差异仅存在于后端执行细节。

#### Scenario: claude deletion path

- **GIVEN** 目标会话是 Claude 会话
- **WHEN** 删除请求被执行
- **THEN** 系统 MUST 执行 Claude session 文件硬删除
- **AND** 删除失败 MUST 回传错误，不得吞错

#### Scenario: codex-opencode deletion path

- **GIVEN** 目标会话是 Codex 或 OpenCode 会话
- **WHEN** 删除请求被执行
- **THEN** 系统 MUST 调用各自后端删除能力并返回明确结果
- **AND** 仅在后端成功时才从列表移除
