## Context

当前实现存在两类断层：

1. 删除语义断层：Workspace Home 删除会话时，前端先执行本地移除，再异步调用后端。后端失败会被吞掉，导致 UI
   与持久化状态不一致，重启后会话“复活”。
2. 能力入口断层：OpenCode chat 已在系统中可用，但 Workspace Home 引擎下拉仍显示为“即将支持(禁用)”，用户无法从首页直达该能力。

约束与现状：

- 前端为 React + TypeScript，状态管理基于 hooks/reducer。
- 后端为 Rust + Tauri Command，Claude 删除走 jsonl 文件删除，Codex/OpenCode 走 thread/archive 或相关会话路径。
- 当前删除流程缺少统一的“结果回执协议”（success / partial / failed 及原因分类）。
- 质量要求：不破坏现有会话数据结构；失败必须可观测；交互不可出现“假成功”。

相关方：

- 终端用户：期望“删除即消失且不复活”。
- 客户端开发：需要稳定、可测试的删除契约。
- 后端开发：需要统一错误分类和返回结构，减少前端猜测。

## Goals / Non-Goals

**Goals:**

- 建立“真删除”判定标准：仅当后端确认成功，前端才从会话列表永久移除。
- 支持批量删除的部分成功回执，确保失败项可见、可重试。
- 打通 Workspace Home 的 OpenCode 引擎入口，使首页“新建会话”能直接进入 OpenCode chat。
- 对齐首页可用性展示与真实能力，移除“已支持但禁用”的错误状态。

**Non-Goals:**

- 不实现会话回收站和恢复机制。
- 不引入新的存储后端或迁移会话文件格式。
- 不重构整个 threads 架构，仅调整删除与入口相关链路。

## Decisions

### Decision 1: 删除流程采用“后端确认优先”而非乐观 UI

- 选项 A：保持乐观 UI（点击后立即本地移除，失败仅日志）
- 选项 B：后端确认后再提交最终移除（推荐）

取舍：选择 B。

原因：本问题本质是“语义可信度”问题，不是“交互速度”问题。乐观 UI 会在失败时制造假成功；后端确认模型可保证重启后一致性。

落地要点：

- `onDeleteConversations` 改为返回结构化结果（成功 IDs、失败 IDs、错误分类）。
- 本地状态对成功项执行移除；失败项保留并标记错误提示。
- 删除期间禁止重入；请求完成前不退出管理态或由结果驱动退出。

### Decision 2: 定义统一删除回执协议（DeleteResult）

- 选项 A：复用当前 `Promise<void>`，前端靠异常判断
- 选项 B：显式结构化回执（推荐）

取舍：选择 B。

原因：批量删除天然存在 partial success；`void/throw` 无法表达每条会话结果。结构化回执更利于 UI、埋点和自动化测试。

建议回执模型：

- `successThreadIds: string[]`
- `failed: Array<{ threadId: string; code: string; message: string }>`
- `summary: { requested: number; succeeded: number; failed: number }`

错误码建议：

- `WORKSPACE_NOT_CONNECTED`
- `SESSION_NOT_FOUND`
- `PERMISSION_DENIED`
- `IO_ERROR`
- `ENGINE_UNSUPPORTED`
- `UNKNOWN`

### Decision 3: 引擎差异收敛到“同一 UX 语义，不同后端实现”

- 选项 A：对每个引擎暴露不同删除按钮语义
- 选项 B：统一 UI 语义为“删除会话”，后端按引擎执行并回执（推荐）

取舍：选择 B。

原因：用户只需要“是否真的删除成功”，不应学习引擎差异。引擎差异应封装在后端适配层。

落地要点：

- Claude：继续文件级 hard delete，但必须把结果写入统一回执。
- Codex/OpenCode：补齐可确认的删除/归档执行路径（确保 workspace/session 前置条件），失败不可静默。
- 任何失败都不得被吞，必须进入回执并通知前端。

### Decision 4: OpenCode 首页入口与能力状态对齐

- 选项 A：继续在 Workspace Home 禁用 OpenCode，仅在其他入口可用
- 选项 B：在 Workspace Home 启用 OpenCode 并接入现有 chat 启动链路（推荐）

取舍：选择 B。

原因：当前属于产品一致性缺陷。既然 OpenCode chat 已支持，首页引擎选择应保持同一能力面，避免“功能存在但入口阻断”。

落地要点：

- 引擎下拉中 OpenCode 从 disabled 改为 enabled。
- “新建会话”对 OpenCode 走已有 `startThreadForWorkspace + engine=opencode` 路径。
- 若 OpenCode 运行时不可用，展示可操作错误（安装/配置提示），而不是静态“即将支持”。

### Decision 5: 删除结果可见性与可观测性默认开启

- 选项 A：仅在 debug 面板记录错误
- 选项 B：用户可见 toast + debug 明细 + 结构化埋点（推荐）

取舍：选择 B。

原因：删除是高信任动作，失败必须用户可见。仅 debug 可见会误导用户并放大问题复现成本。

落地要点：

- 用户层：成功/失败摘要 toast（例如“删除 5 条，失败 2 条”）。
- 工程层：保留 debug 条目并附 threadId 与 error code。
- 数据层：增加删除成功率指标，为后续稳定性治理提供依据。

## Risks / Trade-offs

- [删除等待后端确认导致体感变慢] → 使用“删除中”状态和逐步结果反馈，保证可感知进度。
- [批量部分失败增加 UI 复杂度] → 标准化失败展示模板，失败项保留可二次操作。
- [不同引擎后端路径差异导致实现分叉] → 强制统一 DeleteResult 协议，分叉仅限适配层。
- [OpenCode 在部分机器不可用时首页体验回退] → 启用入口但提供明确错误提示与修复引导，避免虚假禁用文案。
- [历史代码对 `Promise<void>` 依赖广] → 通过类型收口分阶段迁移，避免一次性破坏调用方。

## Migration Plan

1. 定义删除回执类型（前端 + Tauri command 返回结构对齐）。
2. 改造 Workspace Home 删除链路：从 `void` 改为消费 DeleteResult。
3. 改造 threads 删除实现：按引擎执行并汇总结果，禁止吞错。
4. 对齐 OpenCode 首页入口：启用下拉选项并连通新建会话动作。
5. 增加测试：
    - 删除全成功/全失败/部分失败
    - workspace 未连接错误
    - 重启后不复活回归
    - OpenCode 首页新建成功与不可用报错
6. 发布策略：灰度开启（若配置支持）或通过 feature flag 分批验证。

Rollback Strategy:

- 保留旧删除入口分支（仅短期），通过开关回退到旧行为。
- 若 OpenCode 首页入口导致严重回归，可临时隐藏入口但保留后端回执改造。
- 回滚不涉及数据结构迁移，无数据不可逆风险。

## Open Questions

- Codex/OpenCode 的“真删除”在当前 CLI 能力边界内是 hard delete 还是 archive+不可见策略？需明确产品定义。
- 批量删除失败提示是否需要可展开明细（逐条 threadId）还是仅摘要？
- OpenCode 运行时不可用时，首页是否需要“一键诊断”动作（检查 binary/provider 配置）？
