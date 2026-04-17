# Design: OpenCode Engine Integration

## Context

当前多引擎架构已经具备 Claude 与 Codex 的稳定能力，但 OpenCode 仍处于“类型已预留、实现未接入”的状态。现状中，前端发送分发在
`useThreadMessaging` 仍是二路逻辑（Claude 分支与其他分支），导致 OpenCode 即使在 UI 暴露选项，也无法走独立执行链路。

本次设计目标是在不破坏现有 Claude/Codex 行为的前提下，完成 OpenCode 的独立接入闭环：检测、切换、模型、发送、流式事件、中断与错误处理。

约束：

- 不修改 Claude/Codex 现有内部行为语义。
- 不新增冗余前端专用命令，优先复用既有抽象（如 `get_engine_models(engineType)`）。
- OpenCode 通过独立模块接入，不将逻辑硬塞到 Codex 分支。
- 变更必须支持回滚，且回滚后不影响现有引擎。

## Goals / Non-Goals

**Goals:**

- 新增 OpenCode CLI 检测与状态展示（版本、安装态、模型、能力）。
- 新增 OpenCode 独立会话实现（`opencode.rs`）并接入 `EngineManager`。
- 将前端发送分发改为三路（`claude / codex / opencode`），保证分支隔离。
- 复用统一事件协议 `EngineEvent`，避免前端大面积适配。
- 完成单元 + 集成 + 手工验证路径。

**Non-Goals:**

- 不开发 OpenCode CLI 本身。
- 不重构整个引擎抽象层协议。
- 不在本期引入新的存储层或跨工作区会话共享。

## Decisions

### Decision 1: OpenCode 采用独立会话模块 `opencode.rs`

- 选择：在 `src-tauri/src/engine/` 新增并行于 `claude.rs` 的 `opencode.rs`，负责命令构建、进程生命周期、stdout/stderr
  流处理、事件发射。
- 原因：满足“独立接入、零侵入现有引擎”的边界要求。
- 备选：复用或改造 `codex_adapter.rs`。放弃原因：Codex 是 app-server JSON-RPC 适配，OpenCode 为 CLI 流式模型，协议形态不同。

### Decision 2: 前端发送分发从二路升级为三路

- 选择：把当前 `if/else` 调度改成显式三路分发：
    - `claude`：保持 `engineSendMessage` 现有路径。
    - `codex`：保持 `sendUserMessageService` 现有路径。
    - `opencode`：新增独立分支，走 `engineSendMessage` + OpenCode 后端分支。
- 原因：这是 OpenCode 真正可用的关键门槛。
- 备选：仅在 else 分支里塞 `opencode` 兼容判断。放弃原因：长期可维护性差，且容易造成分支语义漂移。

### Decision 3: 模型查询复用统一接口

- 选择：复用 `get_engine_models(engineType)`，不新增 `get_opencode_models()`。
- 原因：降低接口熵，保持跨引擎一致心智。
- 备选：新增 OpenCode 专用命令。放弃原因：重复能力，后续维护成本高。

### Decision 4: 事件映射严格对齐现有 `EngineEvent`

- 选择：OpenCode 解析层输出统一事件类型 `TextDelta / ToolStarted / TurnCompleted / TurnError` 等。
- 原因：可直接复用 `engine_event_to_app_server_event` 与现有前端消费链路。
- 备选：定义 OpenCode 专属事件枚举。放弃原因：前后端都要额外适配，回归风险更高。

### Decision 5: 支持范围与 UI 状态同步收口

- 选择：同步更新 `is_supported`、`detect_all_engines`、`resolve_engine_type`、`get_engine_models` 的 OpenCode 分支，并在
  `EngineSelector` 中将 OpenCode 从 coming soon 调整为 implemented。
- 原因：避免“后端可用但 UI 仍不可选”或“UI 可选但后端不支持”的断层。

## Architecture

### Backend

- `engine/status.rs`
    - 新增 `detect_opencode_status()`、`get_opencode_home_dir()`、`get_opencode_models()`。
    - 扩展 `detect_all_engines()` 返回 OpenCode 状态。
    - 扩展 `resolve_engine_type()` 识别 `opencode`。
- `engine/mod.rs`
    - 增加 `pub mod opencode;`
    - 扩展 `EngineFeatures::opencode()`。
    - 扩展 `EngineType::is_supported()`。
- `engine/manager.rs`
    - `detect_single_engine()` 增加 OpenCode 分支。
    - 增加 OpenCode 会话注册/获取/清理。
- `engine/commands.rs`
    - `get_engine_models()` 支持 OpenCode。
    - `engine_send_message()` 增加 OpenCode 分支。
    - `engine_interrupt()` 增加 OpenCode 分支。

### Frontend

- `useThreadMessaging.ts`
    - 发送分发升级为三路，保持旧分支行为不变。
- `EngineSelector.tsx`
    - OpenCode 接入完成后加入 `IMPLEMENTED_ENGINES`。
- `useEngineController.ts`
    - 确保显示映射与可用状态渲染一致。

## Risks / Trade-offs

- [风险] OpenCode CLI 事件格式与预期不一致。
    - [缓解] 事件解析容错；未知事件落 `Raw`；保留 stderr 日志。
- [风险] 三路分发改造引入回归。
    - [缓解] 保持 Claude/Codex 分支代码块原样，仅新增 OpenCode 分支；补充分发测试。
- [风险] 引擎能力矩阵与 UI 展示不同步。
    - [缓解] 统一以 `EngineStatus.features` 驱动可见性与选项状态。

## Migration Plan

1. 完成后端检测与支持范围扩展（不触达发送链路）。
2. 完成 OpenCode 会话模块与命令分支。
3. 完成前端三路分发与引擎可选状态修正。
4. 完成回归测试与手工验证。

Rollback Strategy:

- 回滚顺序：前端分发改造 -> OpenCode commands 分支 -> OpenCode session 文件 -> 状态检测扩展。
- 回滚后 Claude/Codex 路径保持原样，无数据迁移成本。

## Open Questions

1. OpenCode CLI 当前稳定输出格式是否包含 tool 级事件与 usage 字段？
2. OpenCode 是否原生支持 `--reasoning-effort` 与 `--collaboration-mode`，还是需降级忽略？
3. OpenCode 图片输入是否与 Claude 一样采用 `--input-format stream-json + stdin`？
