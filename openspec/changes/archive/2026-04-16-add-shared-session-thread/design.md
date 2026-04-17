## Context

当前代码库已经有一套较成熟的多引擎会话体系，但默认前提仍然是“一个 thread 归属一个 engine”：

- `ThreadSummary.engineSource` 目前只表达 `codex | claude | gemini | opencode`，多个 UI surface 会据此决定 badge、激活引擎和会话行为。
- `selectedAgentSession.ts` 仍存在基于 `threadId` 前缀推断引擎的逻辑，这意味着线程身份与执行引擎被默认绑在一起。
- `conversationCurtainContracts.ts` 与现有 realtime/history loader 已经把不同引擎的事件归一化到统一幕布状态，这是本提案最大的可复用基础。
- `useThreadActions.ts` 当前仍按 native engine 选择 history loader 与会话恢复路径；`start_thread` / `send_user_message` / `resume_thread` 也主要围绕 native thread 展开。
- Rust 侧已有原子写入与文件锁基础设施（`storage.rs`、`client_storage.rs`），足够承接新的 backend-owned shared store。
- 仓库已经启用大文件治理门禁 [large-file-governance.yml](/Users/chenxiangning/code/AI/github/mossx/.github/workflows/large-file-governance.yml)，其 hard gate 要求新增超大文件必须在同一 PR 内完成拆分；对应策略见 [large-file-governance-playbook.md](/Users/chenxiangning/code/AI/github/mossx/docs/architecture/large-file-governance-playbook.md)。

这说明 `shared session` 不应该被实现成“某个引擎 thread 的 UI 马甲”，而应该是一个新的会话聚合层：上层提供单一共享对话，下层把每个 turn 路由给某个 native engine 执行，并把结果回写到一份 canonical conversation log。

本设计已确认 3 个关键产品决策：

- `shared session` 使用独立存储格式，不借用任何 native engine session 作为主真值。
- 每条 assistant 消息都明确显示来源引擎。
- 当前引擎选择只在当前 `shared session` 内 sticky 生效，不跨 session 共享。
- 实现策略以“新增模块”为主、桥接现有入口为辅；不把 shared session 主逻辑继续堆进现有超大文件。
- 设计与实现必须显式覆盖 `Windows / macOS` 文件系统与路径兼容语义。

## Goals / Non-Goals

**Goals:**

- 引入 first-class `shared session` 聚合模型，在现有 `Codex / Claude` 之上提供单一共享 thread。
- 保持现有 conversation renderer、session list、topbar tabs、session activity 尽量复用统一 contract，而不是重做第二套 UI。
- 让 shared thread 的当前引擎选择、历史恢复、来源引擎标识和 turn 级单引擎约束可稳定落盘并可回放；V1 仅覆盖 `Codex / Claude`。
- 保证 native `Codex / Claude / Gemini / OpenCode` 会话的创建、发送、恢复和列表行为不回退。

**Non-Goals:**

- 不实现多引擎并行 fan-out。
- 不实现单 turn 中途 handoff。
- 不让多个引擎直接共写同一 native session 文件。
- 不引入自动路由、按任务类型智能选引擎或 failure fallback 到其他引擎。
- 不做 native session 到 shared session 的批量迁移。

## Decisions

### Decision 1: 引入独立的 `SharedSessionAggregate` 与 backend-owned store

采用新的共享会话聚合模型，而不是复用任一 native engine session 作为主存储。

#### Chosen

在 Rust 侧新增 `shared_sessions` 模块，使用独立目录与独立 read/write command 管理 shared session：

```text
shared_sessions/
  <workspace-id>/
    <shared-session-id>/
      meta.json
      log.jsonl
```

- `meta.json` 保存会话摘要字段：
  - `id`
  - `workspaceId`
  - `title`
  - `createdAt / updatedAt`
  - `selectedEngine`
  - `lastTurnSeq`
  - `bindingsByEngine`
  - `archived / deleted`（若沿用现有生命周期策略）
- `log.jsonl` 保存 canonical append-only event/turn log：
  - `turnStarted`
  - `userMessage`
  - `assistantItem`
  - `toolActivity`
  - `turnCompleted`
  - `turnFailed`

#### Why

- 独立存储才能真正保证 shared thread 是产品真值，而不是附着在某个 engine 的 private state 上。
- `meta + append-only log` 比单个巨大 JSON 更适合持续写入、历史恢复和 provenance 回放。
- 当前已有文件锁和原子写入能力，可以直接复用到新模块中。
- shared store 放在 Rust 侧，能更自然地复用现有跨平台文件写入、防锁竞争和路径解析能力，避免前端按平台分叉。

#### Alternatives Considered

- 方案 A：复用某个 native engine session 作为 shared 主会话。
  - 拒绝原因：shared 语义会被该引擎的 lifecycle、history format 和 compaction 语义绑死。
- 方案 B：只把 shared session 放在前端 `client_store`。
  - 拒绝原因：这种方案无法稳定承接重开、历史恢复、后台协调和多窗口一致性。

### Decision 1.5: Win/mac 兼容性采用“路径/文件语义统一封装”，禁止平台假设散落在 shared session 主逻辑

共享会话的存储、恢复和 hidden binding 管理必须建立在现有跨平台基础设施之上，而不是在业务逻辑里散落 `Windows/macOS` 特判。

#### Chosen

- Shared session 存储目录通过现有 app path / storage helper 统一解析，不在前端或业务层拼接绝对路径。
- 文件创建、原子覆盖、锁文件等待、临时文件重命名继续复用 Rust 侧 `storage.rs` 风格能力，保持 `Windows / macOS` 一致语义。
- binding metadata 只保存结构化字段（`nativeThreadId`、时间戳、engine 等），不在 shared meta 中固化平台相关临时路径。
- 任何 shared session 相关路径比较都必须走 normalize helper，不允许直接依赖路径分隔符或大小写行为。
- 如需写入本地隐藏目录，命名与读取规则必须对 `Windows / macOS` 等价，不允许出现只在单平台稳定的目录约定。

#### Why

- shared session 是典型“落盘 + 恢复 + 跨 runtime”能力，最容易因为路径和文件语义假设在双平台上表现不一致。
- 平台差异若散落进业务逻辑，后续增量修改几乎必然继续扩散。

#### Alternatives Considered

- 方案 A：shared session 业务模块内部直接按平台分支处理路径和文件动作。
  - 拒绝原因：会快速把业务层污染成平台补丁集合，难以测试和维护。
- 方案 B：先只保证 macOS，可用后再补 Windows。
  - 拒绝原因：这类存储协议一旦上线，再回头补平台兼容会放大迁移成本。

### Decision 2: shared session 维护“按引擎惰性创建的 hidden bindings”

`shared session` 的 canonical log 是唯一用户真值，但真正执行 turn 时，系统仍为每个已使用过的受支持 engine 维护一个 hidden native binding。

#### Chosen

`meta.bindingsByEngine` 记录每个受支持引擎在该 shared session 下的内部 binding：

```text
SharedEngineBinding
- engine
- nativeThreadId
- createdAt
- lastUsedAt
- lastSyncedTurnSeq
```

行为规则：

- 首次在 shared session 中选择 `Codex` 或 `Claude` 时，惰性创建该 engine 的 hidden native thread。
- 若该 engine 之前已经用过，则继续复用它自己的 hidden binding。
- 当 shared session 在另一个受支持引擎上又新增了若干 turn，随后用户切回旧 engine 时，系统在发送真实用户消息前，先基于 canonical log 生成一段 delta sync context，把 `lastSyncedTurnSeq` 之后的共享对话摘要同步进该 binding。

#### Why

- 如果不维护 hidden binding，那么每次切换引擎都要把整段共享历史重新灌给目标引擎，成本高且容易漂移。
- hidden binding 让“切回同一引擎继续聊”具备真正的连续性，同时 shared log 仍保持上层统一。
- `lastSyncedTurnSeq` 提供了可恢复、可审计的同步边界，避免 engine 侧上下文与 canonical log 长期分叉。

#### Alternatives Considered

- 方案 A：每次发送都从 canonical log 全量重建 prompt。
  - 拒绝原因：上下文成本过高，且会把引擎原生连续对话能力浪费掉。
- 方案 B：完全不为 engine 保存历史，切换回来就当新会话。
  - 拒绝原因：这会直接违背“同一共享对话里既要又要用多个引擎”的核心价值。

### Decision 3: 统一 read model，新增 `threadKind`，不把 `shared` 塞进 `EngineType`

`shared` 不是一个可执行 engine，而是一种 conversation kind；设计上必须把“会话类型”和“执行引擎”拆开。

#### Chosen

扩展前端/IPC read model：

```text
ThreadSummary
- id
- name
- updatedAt
- threadKind: native | shared
- engineSource?: codex | claude | gemini | opencode
- selectedEngine?: codex | claude   // shared session current selector
```

规则：

- native session：`threadKind = native`，`engineSource` 仍表示其 native engine。
- shared session：`threadKind = shared`，`selectedEngine` 表示当前 sticky 选择，范围仅 `codex | claude`；`engineSource` 可以作为“当前展示 badge 的执行引擎快照”，但不能再被当作 session 类型本身。
- 所有依赖 `threadId` 前缀推断 engine 的逻辑，需要迁移为优先读取 `threadKind + selectedEngine + engineSource` 的显式元数据。

#### Why

- 若把 `shared` 硬塞进 `EngineType`，会污染执行路径、模型选择器和 engine capability 语义。
- `threadKind` 能明确告诉 topbar、thread list、session activity、history loader：这是一个 shared 聚合会话，而不是某个 native engine thread。

#### Alternatives Considered

- 方案 A：把 `shared` 作为第五种 engine。
  - 拒绝原因：shared 没有独立 runtime，也不该参与 engine feature matrix。
- 方案 B：继续只靠 `threadId` 前缀猜测。
  - 拒绝原因：shared thread 不再等于单一 engine thread，这条假设在架构上已经失效。

### Decision 4: 读路径统一进现有 thread surface，写路径使用 shared-specific commands

共享会话需要尽量复用当前“线程列表/恢复/幕布”体系，但发送和创建必须使用专用命令，避免把 native send path 弄脏。

#### Chosen

- 统一 read path：
  - `list_threads` 返回 native + shared 两类 `ThreadSummary`
  - `resume_thread` 根据 `threadKind` 分流到 native history loader 或 shared store loader
  - rename/archive/delete 这类 thread-level 操作按 `threadKind` 走对应实现
- shared-specific write path：
  - `start_shared_session(workspaceId, selectedEngine?)`
  - `send_shared_session_message(workspaceId, sharedSessionId, engine, text, options)`
  - `interrupt_shared_turn(workspaceId, sharedSessionId, turnId)`（如需要）

#### Why

- 线程列表、Tabs、session activity、search provider 已经围绕统一 `ThreadSummary` 展开，read path 复用收益最大。
- `send_user_message` 的 contract 是“对某个 native thread 发消息”，若硬塞 shared 语义进去，native engine path 会出现大量条件分支。
- 通过 shared-specific commands + read-model bridge，可以把对现有大文件的修改压到 facade/分流层，符合新增模块优先的工程约束。

#### Alternatives Considered

- 方案 A：所有现有命令都 overloading 支持 shared。
  - 拒绝原因：native 路径会被 shared 语义大面积污染，风险高。
- 方案 B：shared session 完全独立一套列表和恢复入口。
  - 拒绝原因：会复制整个 thread surface，后续维护成本高。

### Decision 4.5: 实现拆分遵循“新增模块优先、桥接接入、门禁先行”

shared session 作为跨前后端能力，默认采用新增模块/目录承载实现，只在既有入口文件保留最小桥接。

#### Chosen

- 前端优先新增：
  - `shared-session` loader / selector / adapter / command bridge
  - provenance badge renderer 或等价独立组件
  - shared composer engine selector
- 后端优先新增：
  - `shared_sessions` store / runtime / command module
  - hidden binding manager
  - delta sync builder
- 既有高风险大文件仅保留：
  - command dispatch / hook wiring
  - `threadKind` 分流
  - facade export
- 开发和验收期间必须运行 large-file governance gate，避免“功能落地后再补拆分”。

#### Why

- 这是一个新能力，不是给现有单引擎线程逻辑打几个 if 就能收住的改动。
- 新增模块可以把 shared session 的演进边界独立出来，也更符合本仓库的大文件治理策略。

#### Alternatives Considered

- 方案 A：直接在 `app-shell.tsx`、`useThreads.ts`、`useThreadActions.ts`、`app_server.rs` 内联实现。
  - 拒绝原因：短期快，长期一定失控，而且容易直接撞上 large-file hard gate。
- 方案 B：先内联实现，稳定后再拆。
  - 拒绝原因：与当前仓库的治理门禁正面冲突，且“后拆”通常不会发生。

### Decision 5: shared 历史与实时事件继续复用 unified conversation contract，但增加 provenance 字段

共享会话不应该拥有第二套消息 renderer；它应该继续复用现有 normalized conversation state，只是增加 shared-specific meta。

#### Chosen

- `NormalizedThreadEvent.engine` 继续表示“本次事件真实来自哪个执行引擎”，不改成 `shared`。
- `ConversationMeta` / `NormalizedHistorySnapshot` 增加 shared-specific 字段，例如：
  - `threadKind`
  - `selectedEngine`
  - `provenanceMode: explicit`
- 共享历史 loader `createSharedHistoryLoader` 从 `log.jsonl` 还原出统一 `ConversationItem[]`。
- shared send path 产出的 turn 事件，最终也汇合为现有 normalized event stream；幕布与 reducer 不关心底层 binding，只看 shared `threadId` 和 per-item provenance。
- 每条 assistant item / key activity item 都携带显式 engine provenance，供 `Messages`、session activity 与 hover/detail badge 使用。

#### Why

- 当前 conversation assembler/reducer 已经是多引擎共用的最好资产，shared session 最该复用的就是这一层。
- provenance 是 shared UX 的核心，如果只在 turn 头部隐约显示一次，用户会很快失去“这句话是谁说的”的判断。

#### Alternatives Considered

- 方案 A：为 shared session 新建独立 renderer。
  - 拒绝原因：重复建设，且会让现有消息 contract 再次分叉。
- 方案 B：只在 thread summary 上显示当前引擎，不在 item 上标 provenance。
  - 拒绝原因：共享对话一旦跨 turn 切换引擎，用户无法准确理解历史来源。

### Decision 6: 当前引擎选择的真值存于 shared session meta，作用域仅限当前 session

当前引擎选择必须是 session-scoped sticky state，而不是 workspace/global 级偏好。

#### Chosen

- `meta.selectedEngine` 是 shared session 当前引擎的后端真值。
- 前端 composer 在进入 shared session 时读取这个值；用户切换 selector 后，更新当前 shared session 的 meta。
- pending/new shared session 创建阶段允许前端持有短暂 draft，但一旦 shared session 创建成功，后续都以 backend meta 为准。
- 切换到其他 shared session 或 native session 时，不共享这个值。

#### Why

- 同一 workspace 里不同 shared session 可能承担完全不同角色，一个偏 `Claude`、一个偏 `Codex` 很正常。
- 如果用全局 sticky，会把 A 对话的引擎偏好污染到 B 对话。

#### Alternatives Considered

- 方案 A：workspace 级 sticky。
  - 拒绝原因：会话之间的上下文偏好会互相干扰。
- 方案 B：全局 sticky。
  - 拒绝原因：污染范围更大，也更难向用户解释。

### Decision 7: selector 更新只写 shared meta，不在切换时即时拉起 native session

共享会话里切换引擎属于“下一轮执行意图”更新，而不是立即发起一轮 native 会话执行。

#### Chosen

- `set_shared_session_selected_engine` 仅更新 `meta.selectedEngine` 与 binding 元数据，不主动 materialize 实际 native session。
- 真实 native session 创建/继续仅发生在 `send_shared_session_message` 发送链路。
- 对 Codex / Claude 都保持同一策略：selector 改动不触发后台发送，不创建用户可见本地会话。

#### Why

- 用户在 shared session 中切换 selector 时，预期是“准备下一轮引擎”，不是“立即出现新的本地会话”。
- 这一策略可直接消除“共享会话触发额外本地会话”和“本地悬挂会话不结束”的风险。

#### Alternatives Considered

- 方案 A：selector 更新时立即拉起 native session。
  - 拒绝原因：会引入额外本地会话副作用，且与用户心智不一致。
- 方案 B：保持 Codex 延迟、Claude 即时创建。
  - 拒绝原因：跨引擎语义不一致，切换行为难以解释和测试。

### Decision 8: pending binding 重绑定必须满足 placeholder 显式前缀 + 唯一性 + 新鲜度

shared runtime bridge 允许 pending placeholder 到真实 native thread id 的重绑定，但必须避免跨会话串线。

#### Chosen

- pending 识别仅接受显式 `*-pending-shared-*` 前缀，不再把普通 UUID 直接当作 pending（尤其是 Codex）。
- runtime bridge 在按 engine 兜底解析 pending binding 时要求候选“唯一匹配”。
- 新增 staleness window：超过阈值的 pending binding 视为过期，不参与重绑定。
- 收到 `thread/started` 等事件时，先尝试精确 threadId 命中，再进行“唯一且新鲜” pending rebind。

#### Why

- shared + native 混合运行时，UUID 形态 threadId 很常见；若把它们当成 pending，会造成错误复用与上下文错位。
- 唯一性和新鲜度保护能显著降低“旧 placeholder 抢占新事件”的概率。

#### Alternatives Considered

- 方案 A：只按 engine 查找最近一个 pending binding。
  - 拒绝原因：多 shared 会话并发时存在高概率串线。
- 方案 B：不做 pending rebind，只依赖初始 threadId。
  - 拒绝原因：Claude/Codex 首轮 finalize threadId 的场景会丢失桥接能力。

### Decision 9: shared 历史与 optimistic reconcile 采用“保守替换 + 包装剥离”策略

共享会话中的用户消息可能以 wrapper/fallback 形态落盘或回放，不能再假设 payload 永远是统一 content array。

#### Chosen

- 用户消息解析支持多层 fallback：`content[]`、direct text、`[User Input]`、mode fallback、shared context sync wrapper。
- `Messages` 显示层增加兜底链路，避免解析后空字符串导致用户气泡丢失。
- reducer optimistic reconcile 改为保守策略：
  - 精确匹配优先替换；
  - 仅在“只有一个 optimistic user 且无真实 user 历史”时允许回退替换；
  - 多 optimistic 未匹配时保留，避免历史被截断。

#### Why

- shared session 的核心价值是“连续对话可读性”；用户消息气泡缺失或误删会直接破坏可追溯性。
- 保守替换虽然增加少量临时重复概率，但能避免不可恢复的历史截断。

#### Alternatives Considered

- 方案 A：任何 real user 到达都替换首个 optimistic user。
  - 拒绝原因：历史补帧/多 optimistic 场景会误删非目标消息。
- 方案 B：只支持 content[] 标准格式。
  - 拒绝原因：无法覆盖 Claude 与 shared sync wrapper 的历史兼容场景。

## Architecture

```text
Shared Session UI
  -> shared thread summary (threadKind=shared, selectedEngine=*)
  -> shared composer engine selector
  -> unified Messages / session activity with provenance badges

Shared Session Commands
  -> start_shared_session
  -> send_shared_session_message
  -> interrupt_shared_turn

Shared Session Runtime
  -> SharedSessionStore (meta.json + log.jsonl)
  -> BindingManager (lazy create / resume hidden native bindings)
  -> DeltaSyncBuilder (canonical log -> engine sync context)
  -> EventBridge (native engine events -> shared thread events)

Native Engine Runtime
  -> codex / claude / gemini / opencode hidden bindings
```

### Frontend Responsibilities

- 在 thread list、topbar tabs、pinned list、session activity 中识别 `threadKind=shared`。
- 在进入 shared session 时，展示 session-scoped engine selector，并读取 `selectedEngine`；V1 仅暴露 `Codex / Claude`。
- shared session 发送时调用专用 command，不走 native `send_user_message`。
- 在 `Messages` 和相关面板中渲染每条 assistant / key activity 的 provenance badge。
- 将依赖 `threadId` 前缀推断 engine 的逻辑切换为读取显式 metadata。

### Backend Responsibilities

- 管理 shared session 的 meta、canonical log、生命周期和文件锁。
- 管理 hidden engine bindings 的创建、恢复、同步与清理。
- 构建 delta sync context，把 shared canonical log 的增量同步到目标 engine binding。
- 将 native engine runtime 产出的事件桥接到 shared `threadId`，同时保留真实 provenance。
- 在 list/resume/read path 中把 shared session 混合进现有 thread surface。

## Risks / Trade-offs

- [Risk] hidden bindings 会带来额外存储与生命周期复杂度
  → Mitigation：按引擎惰性创建；shared session 删除/归档时自动级联清理对应 hidden bindings；用户主列表默认不暴露这些内部 bindings。

- [Risk] canonical log 与某个 hidden binding 可能发生上下文漂移
  → Mitigation：每个 binding 记录 `lastSyncedTurnSeq`；当用户切回该引擎时，先执行 deterministic delta sync，再发送真实 turn。

- [Risk] 现有 UI/Reducer 代码仍隐式假设“thread == single engine”
  → Mitigation：在 `ThreadSummary`、history snapshot、conversation meta 中引入 `threadKind`；补齐 thread list、topbar、session activity、messages、selectedAgentSession 的 contract tests。

- [Risk] selected engine failure 可能让 shared turn 处于半完成状态
  → Mitigation：shared canonical log 采用 turn lifecycle records（started / completed / failed）；失败时只写该 turn 的 selected engine error，不做 silent reroute。

- [Risk] 每条 assistant 消息都显示 provenance badge，视觉密度会上升
  → Mitigation：badge 采用轻量 inline label；仅对 assistant / key activity 展示，不给普通 user message 加额外装饰。

- [Risk] shared session 首轮实现如果继续堆到既有超大文件，CI 会被 large-file gate 卡死
  → Mitigation：默认新增模块承载主逻辑；对高风险入口只做桥接；开发阶段持续运行 `npm run check:large-files:gate` 与 `npm run check:large-files:near-threshold`。

- [Risk] Win/mac 文件语义差异导致 shared store 或 hidden binding 在单平台失效
  → Mitigation：所有 shared session 落盘/路径逻辑统一走 Rust 存储与 path helper；补齐双平台兼容测试样例，避免路径分隔符和 rename 语义假设。

## Migration Plan

1. Rust 侧新增 `shared_sessions` 存储与 runtime 模块，落独立 `meta.json + log.jsonl`。
2. 新增 shared-specific commands，并扩展 `list_threads` / `resume_thread` 的 unified read model。
3. 扩展前端 `ThreadSummary` / conversation meta，引入 `threadKind` 与 `selectedEngine`。
4. 新增 shared history loader、shared composer selector、provenance badge 渲染和 list/tab/activity 适配。
5. 增加 contract tests：
   - shared session 创建与重开
   - engine selector sticky scope
   - turn 级单引擎执行与 failure no-reroute
   - per-message provenance 渲染
   - native session 零回归
6. 执行工程门禁：
   - `npm run check:large-files:near-threshold`
   - `npm run check:large-files:gate`
   - 针对 shared store / binding manager 的 `Windows / macOS` 兼容测试或等价 contract coverage

### Rollback

- 回滚时只需隐藏 shared session 创建入口并停用 shared-specific write commands。
- 现有 native session 路径保持不变，不需要数据迁移回滚。
- 已产生的 shared session 文件保留在独立目录中，不影响 native session；恢复功能时可继续读取。

## Open Questions

- V1 暂无阻断性的未决问题；后续若要支持“同 turn 接力”或“自动路由”，应另开变更，不在本设计内扩展。
