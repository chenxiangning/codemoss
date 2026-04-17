## Context

OpenCode 二期已补齐 commands/agents/variant/stats/share/mcp/lsp 的“能力接入”，但在交互层仍然分散：用户需要在多个位置判断当前模型、provider、mcp
与上下文状态。与此同时，Claude/Codex 已有稳定主流程，不能因 OpenCode UX 改造产生回归。

## Goals / Non-Goals

**Goals:**

- 在 OpenCode 模式下建立“状态透明 + 配置可控 + 低认知负担”的主界面体验。
- 将 OpenCode 配置操作前置到显式 UI（provider health / mcp 控制 / model 标签）。
- 通过架构隔离确保 Claude/Codex 渲染路径、状态路径、命令路径不变。

**Non-Goals:**

- 不重构全局多引擎抽象层。
- 不修改 Claude/Codex 的默认 UI 布局、交互与状态模型。
- 不引入 OpenCode CLI 行为层面的 fork/patch。

## Decisions

### Decision 1: OpenCode UX 采用“专属子域”而非全局统一重构

- Option A: 重构全局三引擎统一 UI 框架（一次性统一所有引擎）
- Option B: 仅新增 OpenCode 子域 UI（推荐）
- 取舍：选 B。A 风险高、改动面大，容易触发 Claude/Codex 回归；B 能快速交付且满足“只改 OpenCode”要求。

### Decision 2: 状态面板采用“OpenCode-only 右侧 Tab 扩展”

- Option A: 改造现有全局侧栏为通用状态中心
- Option B: 在 OpenCode 模式下注入 Status/MCP/Provider Tab（推荐）
- 取舍：选 B。A 会影响现有用户习惯；B 只在 OpenCode 渲染路径启用，隔离性最好。

### Decision 3: Provider/MCP 控制走 OpenCode 专属 Tauri 命令

- Option A: 复用现有 Claude provider/mcp 管理 API
- Option B: 新增 OpenCode 专属 commands 与 payload（推荐）
- 取舍：选 B。A 容易造成语义混淆与跨引擎副作用；B 明确边界，便于测试与回滚。

### Decision 4: 模型标签采用静态映射 + CLI 回传混合策略

- Option A: 完全静态标签（前端写死）
- Option B: CLI metadata 优先，缺失时静态降级（推荐）
- 取舍：选 B。兼顾动态准确性与可用性，避免“盲切模型”。

### Decision 5: Debug 能力下沉到 Advanced

- Option A: 继续主界面可见
- Option B: 默认折叠，仅 Advanced 可见（推荐）
- 取舍：选 B。降低普通用户噪音，同时保留开发排障能力。

## Risks / Trade-offs

- [OpenCode 状态面板信息过载] → 分层展示：默认仅关键状态，详情折叠展开。
- [OpenCode 与全局状态耦合导致串扰] → 引入 `opencode` 命名空间 store + selector 边界测试。
- [Provider 健康检查增加请求噪音] → 增加节流与手动触发优先，后台轮询可配置。
- [MCP 权限提示与真实权限不同步] → 后端返回标准化权限模型并附带原始字段用于兜底展示。

## Migration Plan

1. 新建 OpenCode 专属 UI 子域（组件、hooks、store）。
2. 接入 OpenCode 专属状态聚合 command（status snapshot/provider health/mcp status）。
3. 在 `activeEngine === "opencode"` 条件下挂载新面板，不改其他引擎渲染。
4. 增加回归用例：
    - OpenCode 功能路径可用。
    - Claude/Codex UI 与行为快照不变。
5. Feature flag 发布：`opencodeUxPhase3Enabled`（默认开启于 dev，灰度后全量）。

回滚策略：

- 一键关闭 `opencodeUxPhase3Enabled`，回退到二期 UI；无需数据迁移。

## Open Questions

1. OpenCode session 搜索是否需要支持标签/文件夹（本期可先做搜索+收藏筛选）？
2. Provider 健康检查的默认刷新频率是否应按 workspace 维度可配置？
3. MCP server 级开关是否需要权限确认弹窗（首次开启）？
