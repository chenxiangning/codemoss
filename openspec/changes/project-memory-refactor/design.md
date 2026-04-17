# Design: Project Memory Refactor (V2)

## Context

当前 Project Memory 已确认的改造目标是：提升记忆质量与使用便捷度，同时避免影响客户端其他功能。提案已明确以下核心约束：

- 直接切换 V2，V1 明确弃用且不再改造。
- 单轮绑定模型：`userInput + assistantThinkingSummary + assistantResponse + operationTrail`。
- 原文策略：`userInput/assistantResponse` 原文直存、无限制、不脱敏。
- 操作记录策略：固定 7 字段、三态 `success/failed/skipped`、时间正序、绑定 `turnId/messageId`。
- 删除策略：二次确认、无痕、不可撤销、空壳静默自动删除。
- 旧数据策略：不迁移；无法映射新模型即静默跳过。
- 工程策略：Win/mac 兼容、模块化组合式改造、对其他功能零回归。

## Goals / Non-Goals

**Goals**

- 建立可组合的 V2 记忆架构，收敛采集、融合、检索、展示、删除的行为。
- 在不改 V1 路径的前提下，以新模块承接全部 V2 功能并完成入口切换。
- 保证跨平台一致性（Win/mac）与性能门槛（列表/详情/搜索 P95）。
- 保证对非记忆功能（聊天、文件、Git、会话管理）无行为回归。

**Non-Goals**

- 不引入 DB/向量检索。
- 不对旧数据做迁移或回填。
- 不实现 V1/V2 双轨长期共存。

## Decisions

### Decision 1: 采用“组合式分层模块”，避免大文件侵入改造

新增 V2 模块边界，现有业务通过 Facade 接入，减少横向耦合：

- `MemoryCaptureModule`：输入采集与事件接入。
- `MemoryFusionModule`：assistant 完成后的融合写入与幂等。
- `MemoryStoreModule`：分片存储、读取聚合、删除落盘。
- `MemorySearchModule`：索引构建、搜索、筛选、排序。
- `MemoryViewModule`：详情渲染、折叠、复制、删除交互。
- `PlatformAdapter`：Win/mac 路径与文件系统差异封装。

### Decision 2: V2 数据模型采用“canonical turn fields + compatibility envelope”

```text
ProjectMemoryItemV2
- id, workspaceId, threadId, turnId, messageId
- title, kind, importance, tags, source, fingerprint
- createdAt, updatedAt
- userInput?: string
- assistantThinkingSummary?: string
- assistantResponse?: string
- operationTrail: OperationTrailEntry[]
```

```text
OperationTrailEntry
- actionType: command | file_read | file_write | tool_call | plan_update | other
- target: string
- status: success | failed | skipped
- timestamp: number
- briefResult: string
- durationMs: number
- errorCode: NONE | TIMEOUT | USER_CANCELLED | IO_ERROR | TOOL_ERROR | PERMISSION_DENIED | UNKNOWN
```

补充约束：

- `userInput/assistantThinkingSummary/assistantResponse/operationTrail` 是唯一业务真值。
- `summary/detail/cleanText` 如果在服务层继续暴露，仅作为兼容读模型或索引字段，不能反向覆盖 V2 真值。
- `deletedAt` 不再作为 V2 主路径字段；V2 删除采用物理移除。
- 删除任一核心段或单条操作记录后，若整条记忆无有效内容则静默自动删除整条记录。

### Decision 3: Fusion 采用“turn snapshot reconstruction”，不依赖最小 completed payload

- `onAgentMessageCompletedExternal` 现有最小合同只保证 assistant 最终文本，不保证 reasoning 和 tool snapshot 同时到位。
- V2 fusion 阶段应从当前 thread 状态或标准化 `buildItemsFromThread(...)` 结果中重建当前 turn 快照。
- `project_memory_capture_auto` 允许创建 provisional 记录，但 canonical `userInput` 必须始终保留原文。
- normalize/desensitize 结果仅用于噪声过滤、去重和兼容索引，不能在 capture 阶段覆盖 canonical `userInput`。
- `assistantResponse` 取当前 turn 最终 assistant 文本。
- `assistantThinkingSummary` 优先取当前 turn 可见 reasoning summary；无可见内容则留空。
- `operationTrail` 由当前 turn 的 command/tool/file-change/plan 类 item 映射生成。
- `operationTrail` 采用固定映射矩阵：
  - `commandExecution` -> `actionType=command`
  - `fileChange`、`write/edit/apply_patch` 派生文件改动 -> `actionType=file_write`
  - `read/open/list/search/grep/symbols` 类只读工具 -> `actionType=file_read`
  - `plan/proposed-plan/plan-implementation` -> `actionType=plan_update`
  - 其他工具 -> `actionType=tool_call`
  - 无法归类项 -> `actionType=other`
- `status/errorCode` 采用固定映射矩阵：
  - 成功完成 -> `success + NONE`
  - tool error / timeout / permission denied / IO error -> `failed + 对应 errorCode`
  - user cancelled / interrupted before execution / explicit no-op -> `skipped + USER_CANCELLED 或 NONE`
- 若 turn 快照缺失或不完整，应降级为“仅写入 `userInput + assistantResponse`”，不得阻塞主链路。
- 若 capture 与 fusion 在同一运行期内超出 stale window，应先尝试一次快照补齐；仍无法补齐则删除 provisional 记录。
- 应用启动时必须执行一次 provisional reconciliation；reconciliation 后仍无最终 assistant 正文的记录应被静默移除。

### Decision 4: 存储层采用“60MB 日分片 + 透明聚合”

- 文件按 workspace + 日期组织。
- 单日文件超过 `60MB` 自动滚动到 `YYYY-MM-DD.partN.json`。
- 读取层聚合同日分片并输出统一视图。
- 写入保持文件锁与原子覆盖语义，避免并发损坏。
- JSON 读写、分片扫描、兼容解析、索引重建等阻塞任务必须通过 Rust `spawn_blocking` 或等价 blocking worker 执行，不能直接卡住 Tauri 命令主链路。
- 若单个分片或旧数据文件解析失败，存储层必须隔离坏文件、记录诊断，并继续返回其余可读数据。

### Decision 5: Tauri 命令边界采用“typed payload + internal path resolution”

- 前端到 Rust 的 V2 memory 命令只允许传递：
  - `workspaceId`
  - `memoryId`
  - 查询参数
  - 结构化 patch
- 前端不得传入任何 shard/file 路径，也不得指定物理删除文件位置。
- V2 删除命令不再暴露 V1 风格 `hardDelete` 切换；V2 主路径统一为物理删除语义。
- Rust 存储层内部负责将 typed payload 解析到具体 workspace/date/shard 文件。

### Decision 6: 读取层采用“列表投影 / 详情水合”双模型

- `project_memory_list` 返回 `MemoryListProjection`，只包含列表渲染、排序、筛选、搜索高频需要的字段：
  - `id/title/updatedAt/createdAt/hasOperationTrail/threadId/messageId`
  - 列表摘要片段、命中信息、必要兼容元数据
- `project_memory_get` 返回 `MemoryDetailPayload`，按需水合 `userInput/assistantThinkingSummary/assistantResponse/operationTrail` 完整内容。
- 搜索可以命中完整原文，但首屏列表 IPC 不应为每条记录传输完整原文大字段。
- 该分离用于满足“原文无限制存储”与“列表/搜索性能门槛”同时成立。

### Decision 7: 超长详情正文采用“渐进式 chunk render”

- `userInput` 与 `assistantResponse` 在详情展开后，若超过渐进式渲染阈值，则进入 `DetailChunkRenderer`。
- 渲染策略：
  - 首个文本块同步进入 UI，满足详情首开可见性。
  - 后续文本块按原顺序增量追加，避免一次性挂载超大 DOM。
  - 搜索高亮按 chunk 应用，不允许为了高亮重新一次性重绘整段全文。
- 调度策略：
  - 前端使用 React 19 `startTransition` 配合 cooperative yield 追加 chunk。
  - 若 WebView 环境不支持空闲调度能力，回退到定时分批策略，但仍必须保证主交互可响应。
- 生命周期策略：
  - 区块折叠、详情切换、组件卸载、窗口关闭时，未完成 chunk 任务必须取消。
  - 取消后不得继续触发 state update 或复制快照更新。
- 复制语义：
  - “复制整轮内容”仅在当前可见长文本区块完成渐进式渲染后可用。
  - 这样保持 WYSIWYG 与最终稳定视图一致。

### Decision 8: 搜索采用“全字段覆盖 + 防抖 + 启动预热”

- 搜索覆盖：`userInput/assistantThinkingSummary/assistantResponse/operationTrail.briefResult`。
- 前端输入防抖：`300ms`。
- 启动后自动重建一次内存索引缓存，降低首搜抖动。
- 匹配不区分大小写，高亮仅在详情展示。

### Decision 9: 启动治理采用“后台 reconciliation + 非阻塞预热”

- provisional reconciliation 与索引预热在应用启动后后台执行，不阻塞首屏渲染。
- 对话发送与线程打开优先级高于记忆后台任务；后台任务必须可让出，不允许拖慢主链路。
- 后台任务完成后仅增量刷新受影响 workspace 的列表投影与搜索索引。

### Decision 10: UI / CRUD 旧设计向 V2 让步

- `project-memory-ui` 中“详情自由编辑 / 保存按钮 / 以 detail 为主渲染”的旧要求，不再作为 V2 真值模型约束。
- `project-memory-crud` 中“软删除 / 以 detail 自由覆写记录”的旧要求，不再作为 V2 主路径约束。
- V2 详情采用固定顺序的结构化只读视图；允许复制与删除，不提供自由编辑。
- 若保留手动 note 创建入口，也不得反向定义 turn-bound 记忆的详情结构。

### Decision 11: 删除与更新后必须同步刷新读缓存

- 任意 create/update/delete 成功后，必须同步失效受影响 workspace 的列表投影与搜索索引。
- 段落删除、单条 `operationTrail` 删除、整条记忆删除都必须保证“下一次读取即最新”。
- 不允许出现“详情已经删除，但列表仍可见”或“搜索仍命中已删文本”的 stale 结果。

### Decision 12: 直接切 V2，不引入灰度

- 不使用 feature flag 灰度。
- 入口直接指向 V2 实现。
- V1 仅保留历史代码，不继续演进、不再回改。

## Architecture

```text
UI Events
  -> MemoryCaptureModule (send/capture hooks)
  -> MemoryFusionModule (assistant completed + idempotency)
  -> MemoryStoreModule (write/read/delete/shard)
  -> MemorySearchModule (index/search/filter/sort)
  -> MemoryViewModule (detail render/copy/delete)
  -> PlatformAdapter (win/mac fs/path/newline normalization)
```

### Frontend responsibilities

- 采集/融合事件编排（thread hooks）。
- 通过轻量 projection 命令驱动列表、筛选、搜索；打开详情时再请求 detail hydration。
- 详情交互（折叠、删除确认、复制）。
- 长文本区块的 progressive chunk render、取消清理与复制按钮加载状态管理。
- 搜索防抖与命中高亮渲染。

### Backend responsibilities

- V2 结构落盘与分片读写。
- 幂等写入与删除一致性。
- 通过 blocking worker 承接 JSON 读写、分片扫描与索引重建。
- 列表 projection 构建与 detail hydration 分离。
- 当前 turn 快照重建与 operationTrail 映射。
- 兼容读模型与索引字段生成。
- 索引构建与查询。
- 启动后台 reconciliation / warmup 调度与增量缓存失效。
- 坏分片隔离与诊断日志记录。
- 平台文件差异封装。

## Core Flows

### Flow A: Capture + Fusion

1. 用户发送消息触发 capture（保留现有触发机制）。
2. assistant 完成事件到达，先解析当前 turn 快照。
3. 从快照中重建 assistant 正文、reasoning summary、operationTrail。
4. 以 `workspaceId + threadId + turnId/messageId` 做幂等防重。
5. 生成/更新 V2 记录并落盘。

### Flow B: Detail Delete

1. 用户触发段落或单条操作删除。
2. 弹统一二次确认文案。
3. 确认后立即无痕删除，不提供 Undo。
4. 若成为空壳，静默删除整条记忆。

### Flow C: Search + List

1. 输入搜索词（300ms 防抖）。
2. 搜索先命中索引与列表投影，并按 `updatedAt` 降序输出。
3. 列表显示“有操作记录”标记；支持点击标记直达筛选。
4. 详情显示高亮，列表不显示高亮。

### Flow D: Detail Progressive Render

1. 用户打开详情并展开 `userInput` 或 `assistantResponse`。
2. 若文本未超过阈值，则一次性渲染。
3. 若文本超过阈值，则先渲染首个稳定文本块。
4. 其余 chunk 通过 transition/分批调度按原顺序继续追加。
5. 若用户折叠区块、切换详情或关闭窗口，则立即取消剩余任务。
6. 当前可见长文本区块未完成前，复制按钮保持加载中或暂不可用。

### Flow E: Startup Reconciliation + Warmup

1. 应用启动后，在后台调度 provisional reconciliation。
2. reconciliation 仅处理待恢复 provisional 记录，不阻塞聊天首屏与消息发送。
3. 后台重建 workspace 级索引缓存与列表投影。
4. 完成后对受影响 workspace 触发一次增量刷新。

### Flow F: Delete / Update Cache Invalidation

1. 结构化 patch 或 delete 成功落盘。
2. 同步失效该 workspace 的 projection cache 与 search index。
3. 下一次 list/get/search 读取返回最新结果。
4. 若删除后为空壳，则直接返回“整条已移除”状态，不保留旧投影视图。

### Flow G: Corrupted Shard Isolation

1. 读取 workspace 记忆时扫描同日主文件与分片文件。
2. 若某个文件 JSON 解析失败，仅隔离该文件并记录诊断。
3. 继续聚合其余可读分片生成 list/get/search 结果。
4. 前端不因单个坏分片进入整体不可用状态。

## Compatibility & Regression Guard

- 平台兼容：所有文件路径处理仅经 `PlatformAdapter`，禁止业务层拼平台分支。
- 回归隔离：V2 改动限制在 memory 模块及其入口编排，其他功能只允许只读依赖。
- 合同测试：保持对外调用契约（thread events / facade API）稳定，不破坏现有调用方。
- 命令边界：`src/services/tauri.ts` 与 Rust `tauri::command` 的 payload 字段必须通过契约测试锁定，避免前后端字段漂移。
- 删除/更新命令边界：前端不得传递任意文件路径、分片路径或 V1 删除模式开关给 Rust。
- IPC 节流：列表/搜索必须走批量 projection 读取，禁止为列表每一项触发单独 detail IPC。
- 阻塞隔离：文件存储相关重活必须进入 blocking worker，禁止在 Tauri 命令主线程直接执行大体量 JSON I/O。
- 生命周期清理：详情长文本的 chunk 调度任务在区块折叠、组件卸载、窗口关闭时必须取消，避免前端异步任务泄漏。

## Performance Plan

- 指标门槛：
  - 列表首屏（50 条）P95 <= 300ms
  - 详情打开（首个稳定文本块可见）P95 <= 200ms
  - 1k 条搜索 P95 <= 500ms
- 手段：
  - 列表投影 / 详情水合分离
  - 长文本 progressive chunk render
  - 启动索引预热
  - 启动任务后台化，不阻塞首屏
  - 分片按需读取
  - 详情时间线默认 50 条并“加载更多”

## Risks / Trade-offs

- [Risk] 原文无限制存储可能放大文件体积
  - Mitigation: 60MB 分片 + 透明聚合 + 索引预热
- [Risk] 若列表直接读取完整原文，性能指标会失真
  - Mitigation: projection / hydration 双模型 + IPC 批量读取
- [Risk] 超长 assistantResponse 在详情一次性挂载会阻塞 React 渲染线程
  - Mitigation: progressive chunk render + 首块优先 + 生命周期取消
- [Risk] 阻塞型文件 I/O 若留在命令主链路，会直接拖慢桌面端交互
  - Mitigation: Rust `spawn_blocking` + 批量读写 + 后台 warmup
- [Risk] 某个 JSON 分片损坏会放大成整面板不可用
  - Mitigation: 坏分片隔离、诊断记录、其余分片继续可读
- [Risk] 直接切 V2 没有灰度缓冲
  - Mitigation: 完整回归门禁 + 明确回退预案（版本级回退）
- [Risk] 模块化改造初期接线复杂
  - Mitigation: 先落 Facade，再逐段替换实现

## Migration / Rollout

1. 新增 V2 模块与 Facade。
2. 完成捕获、融合、存储、检索、详情全链路。
3. 入口切至 V2，停止 V1 演进。
4. 执行全量回归并发布。

Rollback（版本级）：
- 若出现阻塞缺陷，通过版本回退恢复到上一个稳定版本（不在当前代码内保留双轨开关）。
