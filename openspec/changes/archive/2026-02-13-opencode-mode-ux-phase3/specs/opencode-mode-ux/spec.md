## ADDED Requirements

### Requirement: OpenCode Unified Status Panel

系统 MUST 在 OpenCode 模式下提供统一状态面板，显示当前会话关键状态。

#### Scenario: show OpenCode runtime status

- **WHEN** 用户进入 OpenCode 模式会话
- **THEN** 界面 MUST 显示 Session、Agent、Model、Provider、MCP、Token/Context 的当前状态

### Requirement: OpenCode Model Metadata Visibility

系统 MUST 在 OpenCode 模式的模型选择器中展示模型元信息标签。

#### Scenario: render model labels in selector

- **WHEN** 用户打开 OpenCode 模型下拉
- **THEN** 系统 MUST 显示每个模型的 speed/cost/context 标签（可为粗粒度）

### Requirement: OpenCode Provider Health Check

系统 MUST 在 OpenCode 模式中提供 Provider 健康检查与显式连接状态。

#### Scenario: test provider connection

- **WHEN** 用户点击 OpenCode Provider 测试连接
- **THEN** 系统 MUST 返回可视化连接结果并展示错误原因（失败时）

### Requirement: OpenCode MCP Granular Control

系统 MUST 在 OpenCode 模式中提供 MCP 总开关与 server 级别开关。

#### Scenario: toggle single MCP server

- **WHEN** 用户切换某个 MCP server 开关
- **THEN** 系统 MUST 仅改变该 server 的可用状态并更新权限提示信息

### Requirement: OpenCode Session Discovery

系统 SHALL 在 OpenCode 模式中提供会话搜索与快捷筛选能力。

#### Scenario: search sessions in OpenCode mode

- **WHEN** 用户在会话列表输入关键词
- **THEN** 系统 SHALL 返回匹配会话并支持最近/收藏筛选

### Requirement: OpenCode Advanced Debug Segregation

系统 SHALL 将 OpenCode 调试能力下沉到 Advanced 区域，不作为主流程入口。

#### Scenario: hide debug tools in primary workspace

- **WHEN** 用户使用 OpenCode 主聊天界面
- **THEN** 系统 SHALL 不在主操作区直接暴露 debug/console/heap 操作
