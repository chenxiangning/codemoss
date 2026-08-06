## MODIFIED Requirements

### Requirement: AskUserQuestion MCP Calls MUST Survive Answers Slower Than The CLI Default Fetch Timeout

系统 MUST 在注入 AskUserQuestion MCP 工具时提高 CLI 的 MCP 工具调用抓取超时，使用户耗时超过 CLI 默认 60s 的回答不会被 CLI 提前放弃并作为 timeout 返回给模型。CLI 超时 MUST 严格大于服务端等待窗口，而不是与之相等 - 相等意味着两侧计时器几乎同时到期，没有为服务端自身的 graceful timeout 响应留出送达 CLI 的时间。

The Claude CLI defaults its per-request MCP tool-call fetch timeout to 60s for
HTTP MCP servers, but an AskUserQuestion blocks on a human for up to the server's
own longer window. Without raising the CLI timeout, a slow answer can be
abandoned by the CLI and lost.

#### Scenario: tool timeout is raised with a margin when the ask is wired

- **WHEN** 客户端为一个 `claude` 会话注入 AskUserQuestion MCP 工具
- **THEN** 命令环境 MUST 设置 `MCP_TOOL_TIMEOUT` 为一个严格大于服务器等待窗口的值（服务器等待窗口 + 固定 margin，毫秒）
- **AND** 一个耗时超过 60s 才提交的回答 MUST 仍被正确送达发起该调用的 turn
- **AND** 服务器等待窗口的值 MUST 来自单一 source of truth，不得在多处独立硬编码

#### Scenario: an explicit user override is respected

- **WHEN** 环境中已存在用户设置的 `MCP_TOOL_TIMEOUT`
- **THEN** 系统 MUST NOT 覆盖该用户显式值

## ADDED Requirements

### Requirement: AskUserQuestion Event Delivery MUST Tolerate Concurrent Turn Event Volume

The session's shared realtime event bus MUST NOT silently drop an `AskUserQuestion` `RequestUserInput` event solely because of unrelated event volume from a concurrent turn in the same session.

#### Scenario: a burst of unrelated event volume does not drop the ask event

- **WHEN** a session has multiple concurrent turns generating event volume
- **AND** an `AskUserQuestion` `RequestUserInput` event is emitted on one of those turns
- **THEN** the event bus capacity MUST be sized to absorb realistic concurrent-turn event bursts
  without the `RequestUserInput` event being dropped as a lagged/skipped event

#### Scenario: a dropped event is diagnosable, not silent

- **WHEN** the event bus does drop events because a consumer fell behind capacity
- **THEN** the drop MUST be logged with enough context to distinguish it from a genuine
  user-timeout when investigating a report
