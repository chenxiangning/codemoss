## ADDED Requirements

### Requirement: Ordinary sidebar hydration MUST be Session Index only

普通侧栏 hydrate（cold first-paint、切工作区、soft refresh、workspace restore）MUST 只把 `list_session_index_for_workspace` 当作 list membership 来源。系统 MUST NOT 为这些路径调用 `list_workspace_sessions`、各引擎磁盘 `list_*_sessions` fan-out，或把 Codex live `listThreads` 当作 membership 来源。

Titles overlay、Shared visibility、archive overlay MAY 继续应用，但 MUST NOT 扩大或缩小 Index 已给出的 membership，除非命中冻结的过滤规则。

#### Scenario: first-paint does not page Codex live threads

- **WHEN** active workspace 执行 first-paint thread list
- **THEN** 客户端 MUST 请求 Session Index
- **AND** MUST NOT 为凑齐可见根数循环调用 `listThreads`
- **AND** 侧栏在 Index + visibility 可用后 MUST 可交互

#### Scenario: workspace restore does not dual-scan

- **WHEN** active workspace 已经完成一次 first-paint hydrate
- **THEN** `useWorkspaceRestore` MUST NOT 再发起第二次 list
- **AND** 启动后静默 1.5s 路径 MUST NOT 再打 first-paint

#### Scenario: force refresh may still use catalog

- **WHEN** 用户显式 force refresh 或打开 Session Management
- **THEN** 系统 MAY 调用 bounded catalog
- **AND** 该路径 MUST NOT 成为 cold start 的自动后续
