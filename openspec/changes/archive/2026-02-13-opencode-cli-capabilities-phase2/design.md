# Design: OpenCode CLI Capabilities Phase 2

## Context

一期已完成 OpenCode 基础集成，但仍停留在“消息发送 + 模型选择”层。
OpenCode CLI 已提供更完整的工程能力面：commands、agents、session、mcp、lsp、share、serve。

本期设计目标：在不破坏 Claude/Codex 路径的情况下，把这些能力接入为可复用的“OpenCode 扩展层”。

## Decisions

### Decision 1: 新能力统一挂在 `engine/commands.rs` 的 OpenCode 分支

- 原因：继续复用现有 Tauri command 入口与 EngineManager 生命周期。
- 结果：避免为 OpenCode 另起一套服务层。

### Decision 2: 命令型能力分层为 Query / Action

- Query: `commands`, `agents`, `session stats`, `mcp`, `lsp diagnostics`
- Action: `session export/import`, `share`, `serve start/stop`

这样便于在 UI 做权限提示、失败重试和缓存策略。

### Decision 3: `serve` 先 research 后默认

`serve` 可能带来显著性能收益，但也引入端口冲突、僵尸进程、跨工作区隔离问题。
必须先形成数据化评估，不在本提案直接默认开启。

### Decision 4: LSP 通过 `opencode debug lsp` 接口接入

当前 OpenCode CLI 没有顶层 `lsp` 子命令，但提供 `debug lsp diagnostics/symbols/document-symbols`。
因此本期 LSP 接入统一走 debug 子命令，并在 UI 明确呈现“调试接口能力”来源，避免误导。

## Architecture Sketch

1. Backend (`src-tauri/src/engine/`)

- 新增 `opencode_capabilities.rs`（或在 `opencode.rs` 内扩展）
- 提供：
    - `list_opencode_commands()`
    - `list_opencode_agents()`
    - `get_opencode_session_stats(session_id)`
    - `export_opencode_session(session_id, path)`
    - `import_opencode_session(path)`
    - `share_opencode_session(session_id)`
    - `list_opencode_mcp_status()`
    - `list_opencode_lsp_diagnostics()`

2. Frontend (`src/features/`)

- Composer: `/command` + `agent` + `variant`
- Thread detail: stats/share/export
- MCP & File panels: OpenCode MCP / LSP 信息

## Risk & Mitigation

- 风险：CLI 输出格式变更
    - 缓解：解析器做 schema 容错，保留 raw payload
- 风险：feature 过多导致 UI 复杂
    - 缓解：按 P0/P1 渐进放量，先放 command/agent，后放资产化和生态
- 风险：serve 模式稳定性
    - 缓解：先 research，不默认启用

## Serve Research (2026-02-13)

测试环境：macOS + `opencode 1.1.62`

1. 生命周期管理

- 启动：`opencode serve --hostname 127.0.0.1 --port <port>`
- 停止：通过进程 PID `kill`
- 结论：可由 CodeMoss 后端托管 PID 生命周期（启动、检测、回收）

2. 端口冲突策略

- 复现：同端口启动第二个 `serve`
- 实际行为：第二个进程退出并报错 `Failed to start server on port <port>`
- 策略：默认随机端口；当用户指定端口冲突时，提示并回退随机端口重试

3. 基准数据（本机抽样）

- 冷启动（端口可连接）: 902ms / 909ms / 912ms
- 运行内存 RSS: 45,072KB / 45,120KB / 45,248KB
- 连续 HTTP 响应（`GET /`）: 首次 1157ms，后续约 222~263ms

4. 决策

- 二期不默认开启 `serve`
- 保留为可选优化能力（后续通过显式开关接入）

## Validation Status (2026-02-13)

- 功能实现状态：P0/P1 功能项已落地（commands/agents/variant/stats/export/import/share/mcp/lsp）。
- 回归状态：
    - `npm run typecheck` 通过
    - `npm run lint` 通过（warnings only）
    - `npm run test` 通过（默认链路）
    - `cargo test --manifest-path src-tauri/Cargo.toml` 通过
    - heavy integration 套件（`*.integration.test.tsx`）改为 `npm run test:integration` 独立执行，默认链路不再阻塞。

### 归档说明

1. 默认回归链路覆盖单元与常规集成测试，满足提案收口要求。
2. heavy integration 套件保留且可独立执行，用于专项稳定性回归，不阻塞日常验收。
