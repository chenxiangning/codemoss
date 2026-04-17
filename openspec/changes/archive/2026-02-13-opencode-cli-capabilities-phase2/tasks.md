# Implementation Tasks: OpenCode CLI Capabilities Phase 2

## 1. Command & Agent 接入（P0）

- [x] 1.1 [P0][depends: none] 在后端增加 OpenCode `commands` 列表查询接口（缓存 + 刷新）。
- [x] 1.2 [P0][depends: 1.1] 在 Composer 菜单中增加 OpenCode `/command` 快速插入与参数提示。
- [x] 1.3 [P0][depends: none] 在后端增加 OpenCode `agents` 列表查询接口。
- [x] 1.4 [P0][depends: 1.3] 在会话级 UI 增加 agent 选择器，并在 `engine_send_message` 传 `--agent`。
- [x] 1.5 [P0][depends: none] 增加 `variant`（如 high/max/minimal）能力映射，并支持每会话记忆。

## 2. Session 资产化（P1）

- [x] 2.1 [P1][depends: none] 对接 `session stats`，在线程详情显示 tokens/cost/duration。
- [x] 2.2 [P1][depends: none] 对接 `session export`，支持导出单会话 JSON。
- [x] 2.3 [P1][depends: 2.2] 对接 `session import`，支持从导出文件恢复为本地线程。
- [x] 2.4 [P1][depends: none] 对接 `share`，支持生成分享链接并在 UI 一键复制。

## 3. MCP/LSP 能力融合（P1）

- [x] 3.1 [P1][depends: none] 对接 OpenCode MCP server 状态查询。
- [x] 3.2 [P1][depends: 3.1] 在 MCP 面板展示 OpenCode 维度的 server 状态与错误信息。
- [x] 3.3 [P1][depends: none] 对接 LSP diagnostics/symbols 查询接口。
- [x] 3.4 [P1][depends: 3.3] 在文件树/编辑辅助中展示 LSP 告警与符号导航入口。

## 4. Serve 模式可行性（P1-Research）

- [x] 4.1 [P1][depends: none] 验证 `opencode serve` 生命周期管理与端口冲突策略。
- [x] 4.2 [P1][depends: 4.1] 输出基准数据：冷启动时延、连续请求时延、资源占用。
- [x] 4.3 [P1][depends: 4.2] 形成是否默认启用 `serve` 的决策记录。

## 5. 质量与回归（P0）

- [x] 5.1 [P0][depends: 1.x] 前端测试：`/command` 插入、agent 切换、variant 透传。
- [x] 5.2 [P0][depends: 2.x,3.x] 集成测试：stats/export/import/share/mcp/lsp happy path 与异常路径。
- [x] 5.3 [P0][depends: 5.1,5.2] 执行 `npm run typecheck && npm run lint && npm run test` 并记录。  
  当前状态（2026-02-13）：`typecheck` 通过、`lint` 通过（warnings only）、`test` 通过（默认链路已排除 heavy integration 套件，
  `*.integration.test.tsx` 通过 `npm run test:integration` 独立执行）。
- [x] 5.4 [P0][depends: 5.2] 执行 `cargo test --manifest-path src-tauri/Cargo.toml engine::` 并记录。

## Validation Snapshot (2026-02-13)

- 提案任务勾选完成率：100%（20/20）
- 实测验收完成率：100%（20/20）
- 当前说明：`useThreads.integration.test.tsx` 为 heavy integration 套件，已从默认回归链路拆分到 `npm run test:integration`
  单独执行，避免默认 CI/本地链路 OOM。
