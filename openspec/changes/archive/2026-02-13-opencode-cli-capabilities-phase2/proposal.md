# OpenCode CLI Capabilities Phase 2

## Why

当前 `opencode-engine-integration` 已完成基础接入（检测、发送、模型、中断）。
但 OpenCode CLI 还有一批高价值能力尚未接入 CodeMoss：

- 自定义 `/command` 与 `agent` 切换
- MCP Server 管理
- LSP / Diagnostics 语义信息
- 会话分享（share）
- 本地服务模式（serve）
- 会话统计与导出（stats / export / import）

这些能力可直接增强 CodeMoss 的工作流深度，不是“锦上添花”，而是把 OpenCode 从“可用”升级到“好用、可协作、可沉淀”。

## What Changes

新增 `opencode-cli-capabilities-phase2` 变更，分三批落地：

1. P0: 直接提升日常使用效率

- OpenCode `/command` 发现与执行
- OpenCode `agent` 列表与会话级切换
- `--variant` 参数透传到 UI（Build/Plan/Quick 等）

2. P1: 可观测与资产化

- 接入 `session stats`（tokens/cost/duration）
- 接入 `session export/import`（会话迁移/归档）
- 会话分享链接能力（share）

3. P1: 生态与深度工具链

- MCP Server 状态查询与快捷配置入口
- LSP diagnostics/symbols 接入到文件树与会话工具面板
- 评估 `serve` 模式（长期可选，用于降低多次进程启动成本）

## Scope Boundary

In-scope:

- OpenCode 功能接入与 UI 编排
- 与现有 Claude/Codex 统一抽象层对齐（不破坏现有分支）

Out-of-scope:

- 重写引擎抽象协议
- 新增远程多租户后端
- 修改 OpenCode CLI 本身行为

## Expected Outcome

完成后，CodeMoss 中的 OpenCode 将从“基础聊天/编码引擎”升级为：

- 可切换 agent 的多工作流执行器
- 可沉淀与迁移会话资产的工程助手
- 可接入 MCP/LSP 生态的本地工程中枢

## Current Delivery Status (2026-02-13)

- 实现完成度：高（功能交付完成，核心路径可用）
- 验收完成度：100%（20/20）
- 回归结论：
    - `npm run typecheck` 通过
    - `npm run lint` 通过（warnings only）
    - `npm run test` 通过（默认链路）
    - heavy integration 套件（`*.integration.test.tsx`）已拆分至 `npm run test:integration` 独立执行，避免默认链路 OOM

## Source Notes (Primary)

- OpenCode CLI command list (`run`, `models`, `agent`, `mcp`, `share`, `session`, `serve`, `import`, `export`)
- OpenCode CLI debug command list (`debug lsp diagnostics/symbols/document-symbols`)
- Local verification on 2026-02-13 with `opencode 1.1.62`
