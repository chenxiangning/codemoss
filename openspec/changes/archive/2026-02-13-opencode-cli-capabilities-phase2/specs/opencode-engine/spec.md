## ADDED Requirements

### Requirement: OpenCode Command Catalog

系统 SHALL 支持读取 OpenCode 可用 `/command` 列表并在 UI 中用于快速插入。

#### Scenario: list OpenCode commands

- **GIVEN** OpenCode CLI 可用
- **WHEN** 用户打开 Composer 的 command 菜单
- **THEN** 系统 SHALL 返回 `opencode commands` 的结果并展示名称、描述、参数信息

### Requirement: OpenCode Agent Selection

系统 SHALL 支持读取并切换 OpenCode agent。

#### Scenario: switch agent for a turn

- **GIVEN** 用户在会话中选择某个 OpenCode agent
- **WHEN** 发送下一条消息
- **THEN** 后端 SHALL 在 OpenCode 调用时追加 `--agent <agent-id>`

### Requirement: OpenCode Session Statistics

系统 SHALL 支持读取 OpenCode session 统计并展示到线程详情。

#### Scenario: show session stats

- **GIVEN** 会话已有输出
- **WHEN** 用户打开线程详情
- **THEN** 系统 SHALL 展示 tokens、duration、cost 等统计字段（若 CLI 返回）

### Requirement: OpenCode Session Export/Import

系统 SHALL 支持会话导出与导入能力，用于会话资产迁移。

#### Scenario: export and re-import a session

- **GIVEN** 用户已完成一个 OpenCode 会话
- **WHEN** 用户执行导出并随后导入
- **THEN** 系统 SHALL 能恢复该会话为可见线程记录

### Requirement: OpenCode Share Link

系统 SHALL 支持会话分享链接生成。

#### Scenario: create share link

- **GIVEN** 用户在会话工具菜单点击分享
- **WHEN** CLI 分享操作成功
- **THEN** 系统 SHALL 返回并展示可复制分享链接

### Requirement: OpenCode MCP/LSP Integration

系统 SHALL 能读取 OpenCode MCP server 状态与 LSP diagnostics，并在 UI 展示。

#### Scenario: show mcp/lsp status in UI

- **GIVEN** OpenCode MCP 或 LSP 存在状态输出
- **WHEN** 用户打开对应面板
- **THEN** 系统 SHALL 渲染状态、错误与关键元信息
