## Context

当前 Codex 协作模式在本地工程中的主链路是：前端选择 `plan/code` -> Tauri 后端透传 `collaborationMode` -> 外部 app-server
决定是否采纳。
这种结构缺少本地“强约束 + 生效验证”能力，导致模式语义可能退化为展示层概念。

基于代码审计的后端现状（As-Is）：

- `src-tauri/src/shared/codex_core.rs`
    - `send_user_message_core` 将 `collaborationMode` 放入 `turn/start` 参数后直接发送。
    - `collaboration_mode_list_core` 直接调用 `collaborationMode/list`。
- `src-tauri/src/codex/mod.rs` / `src-tauri/src/bin/moss_x_daemon.rs`
    - 命令层仅做参数解析与透传，不做 `plan/code` 分支。
- `src-tauri/src/backend/app_server.rs`
    - `WorkspaceSession.send_request` 是通用 JSON-RPC 管道；stdout 事件循环仅路由，不做 mode-aware 策略。
- 检索结果显示 Rust 后端没有 `mode == "plan"` / `mode == "code"` 的执行分支。

结论：本地后端当前不具备“协作模式执行引擎”，仅具备“协作模式参数通道”。

约束条件：

- 不能修改外部 app-server 实现。
- 不能破坏当前线程事件协议与消息流。
- 需要保持现有 `turn/plan/updated`、`requestUserInput`、`respond_to_server_request` 协议兼容。

## Goals / Non-Goals

**Goals:**

- 在本地后端建立 Codex 协作模式运行时策略层，确保 `plan/code` 具备可验证差异。
- 让模式决策具备线程级一致性，并可在事件流中可观测。
- 对 `requestUserInput` 建立模式化控制，避免 `code` 模式落入交互提问流程。

**Non-Goals:**

- 不重写 EngineManager 全链路。
- 不覆盖所有工具行为，仅覆盖协作模式关键路径。
- 不改变非 Codex 引擎行为。

## Decisions

### Decision 1: 引入 `CodexCollaborationPolicy` 本地策略层

- 方案 A：仅透传 `collaborationMode`。
- 方案 B（选择）：透传 + 本地策略计算（effective mode + policy directives）。

选择理由：

- 可以在外部服务行为不稳定时，仍保证本地语义一致。
- 可以输出统一可观测信息（effective mode / policy version / fallback reason）。

实现要点：

- 新增策略模块（建议：`src-tauri/src/codex/collaboration_policy.rs`）。
- 输入：frontend payload + thread id + workspace context。
- 输出：
    - `effective_mode` (`plan` | `code`)
    - `policy_instructions`（追加到 `collaborationMode.settings.developer_instructions` 或等效字段）
    - `request_user_input_policy`（allow / block）

落点：

- 在 `send_user_message_core` 进入 `turn/start` 前执行策略计算。
- 透传 payload 保留，同时注入本地策略结果，形成“兼容透传 + 本地约束”。

### Decision 2: 持久化线程级模式状态（in-memory）

- 方案 A：每轮临时使用前端传入模式。
- 方案 B（选择）：维护 `thread_id -> effective_mode` 映射，并在 turn/start 更新。

选择理由：

- 防止前端暂时缺参或重连后模式抖动。
- 便于事件处理阶段按线程模式执行拦截。

实现要点：

- 状态放在 Codex session 或 AppState 内的受控 map（Mutex 保护）。
- thread fork/resume 时遵循显式策略：继承父线程模式，除非请求中明确覆盖。
- thread mapping 缺失时，回退为“请求显式模式 > 默认 plan”，并写入一次 fallback 日志。

### Decision 3: 在事件入口拦截 `requestUserInput`（仅 code 模式）

- 方案 A：仅前端提示（当前做法）。
- 方案 B（选择）：后端先拦截，再发标准提示事件给前端。

选择理由：

- 前端提示不是强约束，无法阻止模式漂移。
- 后端拦截可让“模式语义”成为系统行为，而不是 UI 约定。

实现要点：

- 在 `app_server` 事件分发环节读取 thread mode。
- 若 `effective_mode=code` 且事件为 `item/tool/requestUserInput`：
    - 不透传原请求到交互卡片；
    - 发送新的系统提示事件（带 threadId + reason + action hint）；
    - 记录一次 mode-enforcement 日志。
- `plan` 模式下保持原行为。

协议兼容策略：

- 不改已有 `respond_to_server_request` 契约。
- 新提示事件新增 method 名称（例如 `collaboration/modeBlocked`），前端按可选事件处理，不影响旧客户端。

### Decision 4: 增加模式生效可观测字段

- 在 turn/start debug payload、后端日志中记录：
    - `selected_mode`
    - `effective_mode`
    - `policy_version`
    - `fallback_reason`（可空）

这样可以明确区分“用户选择”与“实际生效”。

## Implementation Blueprint

### Backend Module Boundary

- `src-tauri/src/codex/collaboration_policy.rs`（新）
    - 责任：规范化输入模式、计算 `effective_mode`、生成策略指令、输出 fallback 原因。
    - 对外接口（示意）：
        - `resolve_effective_mode(input_mode, thread_state) -> EffectiveModeResult`
        - `build_policy_directives(effective_mode) -> PolicyDirectives`
- `src-tauri/src/shared/codex_core.rs`（改）
    - 在 `turn/start` 前调用策略模块，注入 `effective_mode` 对应策略字段。
    - 写入可观测字段（debug/log payload）。
- `src-tauri/src/backend/app_server.rs`（改）
    - 事件循环增加 mode-aware gate：仅拦截 `item/tool/requestUserInput` + `effective_mode=code`。
    - 发送新事件 `collaboration/modeBlocked`（可选消费，兼容旧前端）。
- `src-tauri/src/codex/mod.rs` / state 容器（改）
    - 管理线程级模式映射（Mutex）。
    - fork/resume 时继承模式，显式请求可覆盖。

### Data Contract

- 输入（front payload）：
    - `collaborationMode.mode`（plan/code）
    - `collaborationMode.settings.*`（model/reasoning/developer instructions）
- 输出（effective）：
    - `effective_mode`
    - `policy_version`
    - `fallback_reason`（nullable）
- 事件（新增）：
    - method: `collaboration/modeBlocked`
    - params: `{ threadId, blockedMethod, effectiveMode, reason, suggestion }`

### Backward Compatibility

- 兼容保留：
    - `collaborationMode` 原字段继续透传，避免破坏外部 app-server 已有能力。
    - 既有 `requestUserInput`、`respond_to_server_request` 协议不变。
- 新增能力均为增量：
    - 新事件前端可忽略，不影响旧版本基础流程。
    - 当策略模块异常时回退到“透传优先”，并记录 `fallback_reason=policy_error`。

## Risks / Trade-offs

- [Risk] 后端拦截 `requestUserInput` 可能与未来 app-server 协议变更冲突
  → Mitigation: 通过 method 常量集中管理，并为未知结构保持透传回退。

- [Risk] 线程模式映射在异常恢复后丢失
  → Mitigation: 设计“无状态回退策略”（缺失映射时使用请求显式值，仍写日志）。

- [Risk] 透传策略与本地策略产生冲突
  → Mitigation: 定义优先级规则（本地强约束 > 外部建议），并在日志中显式标记冲突。

## Migration Plan

1. 引入策略模块和线程模式状态容器，先接入 `send_user_message`（不改事件流）。
2. 加入观测日志与前端 debug 面板字段，验证 `effective_mode` 稳定输出。
3. 实现 `requestUserInput` 的 code-mode 拦截与替代提示事件。
4. 补齐测试：
    - 后端：策略决策、线程模式继承、fallback、事件拦截。
    - 前端：拦截事件消费、提示呈现、Plan 正常回归。
5. 灰度启用：默认开启于 Codex 协作模式开关开启场景；必要时可通过 feature flag 回退。

回滚策略：

- 通过 feature flag 关闭本地 enforcement，回到纯透传路径。
- 保留原 `collaborationMode` 透传逻辑，不影响会话可用性。

## Open Questions

- `code` 模式下遇到 `requestUserInput` 时，最佳用户体验是“硬阻断”还是“可一键切换到 plan 并重试”？
- 是否需要将 `effective_mode` 持久化到线程元数据，以支持应用重启后完全一致恢复？
- 本地策略指令应写入 `collaborationMode.settings.developer_instructions` 还是独立字段，以便未来协议升级？

## Validation Strategy

- 单元测试（Rust）
    - `collaboration_policy`：输入归一化、fallback、指令生成、版本号输出。
    - 线程状态：创建/继承/覆盖/缺失回退。
    - 事件 gate：`code` 模式阻断 requestUserInput；`plan` 模式透传。
- 集成测试（Frontend）
    - `useAppServerEvents`：消费 `collaboration/modeBlocked` 并渲染提示。
    - `requestUserInput` 流：`plan` 模式保持现有卡片交互与提交。
- 回归门禁
    - 现有协作模式默认值与非 Codex 引擎行为不变。
    - 现有 `turn/plan/updated` 与计划面板显示逻辑不回退。
