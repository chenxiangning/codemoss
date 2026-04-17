## Context

当前实现已经有两条相互独立、但尚未被统一表达的能力：

1. `MessageQueue` 负责在 composer 顶部展示排队消息，但当前只提供编号、文本预览和删除按钮，视觉样式也仍停留在旧的轻量列表语义。
2. `useQueuedSend` 已经负责处理“运行中继续发送”与“运行结束后自动出队”；在 `steerEnabled=true` 时，运行中消息会直接走 `sendUserMessage`，而不是先 interrupt。
3. 上层线程链路已经具备 `interruptTurn` 能力，但该能力当前挂在 `useThreads -> app-shell -> useComposerController` 之外，尚未接入队列项级操作。

因此本变更不是协议扩展，而是一次前端编排收口：

- 样式层：让排队区域与 composer 输入容器共享同一套圆角/边框/层级语义。
- 行为层：把单条队列项升级成“优先复用现有 in-run follow-up / steer、必要时才 safe cutover”的融合动作。

约束如下：

- 必须保持 TypeScript 严格类型，不允许引入 `any` 或松散 payload。
- 必须避免在高频交互中新增 Tauri 高频 IPC；“融合”只在用户显式点击时触发一次中断和一次发送。
- 必须保证非支持运行态不出现“可点击但不会成功”的假交互，同时不把 generic queue UI 错误收窄成 Codex-only 组件。

## Goals / Non-Goals

**Goals:**

- 让排队区域外观与 composer 输入框形成同源容器关系。
- 为单条排队项提供“融合”动作，并复用现有线程中断与即时发送能力。
- 保证融合后的队列重排、失败恢复、模式保持和线程隔离都有明确状态机。
- 将改动限制在 React 组件树和线程发送 hook，不新增 Rust/Tauri 命令。

**Non-Goals:**

- 不调整 composer 默认发送策略。
- 不新增全局“引导模式”或额外的运行态模型。
- 不重构消息幕布、Plan 卡片或 `requestUserInput` 卡片。
- 不新增跨线程队列共享、批量融合或多条合并发送。

## Decisions

### Decision 1: “融合”优先复用现有 `steer / in-run send`，仅在必要时 fallback 到 safe cutover；不新增 IPC

- 方案 A：新增专用 `fuseQueuedMessage` 后端命令，由 Rust/daemon 统一处理中断和追加。
- 方案 B：前端统一执行 `interruptTurn + immediate send`。
- 方案 C：前端优先走现有 `steer` / same-run follow-up 发送；仅当当前引擎或线程态不支持同轮追加，但支持安全切换时，才走 explicit cutover。

采用 C。

原因：

- 当前产品已存在“运行中直接发送”的 steer 语义；强制 interrupt 会把“并入当前作答”做成“切断后另起一轮”。
- `useQueuedSend` 已具备 `isProcessing + steerEnabled => 直接 sendUserMessage` 的稳定路径，测试也覆盖了这一行为。
- “融合”本质上是 UI 触发的发送编排，不是新的系统能力；把它下沉到 IPC 会放大边界泄露。
- 前端只在显式点击时触发一次融合，不属于高频 IPC 风险。

防御性思考：

- 如果当前运行支持同轮追加，融合 MUST 直接复用该路径，不应人为插入 interrupt。
- 如果同轮追加不可用但 cutover 可用，必须把该消息恢复回原队列位置，不能默默丢失。
- 如果某引擎既不支持同轮追加也不支持安全 cutover，则不提供成功态融合入口。

### Decision 2: 在 `useQueuedSend` 中新增“队列项融合”动作，而不是让 UI 组件直接拼业务

- 方案 A：在 `MessageQueue` 组件里直接调用 `interruptTurn` 和 `sendUserMessage`。
- 方案 B：在 `useQueuedSend` 暴露 `fuseQueuedMessage(threadId, messageId)`，UI 只负责触发。

采用 B。

原因：

- `MessageQueue` 应保持展示组件属性，避免直接耦合线程状态与 Tauri 行为。
- `useQueuedSend` 已是队列 enqueue/dequeue/auto-drain 的单一编排入口，融合动作放在这里最容易保持顺序与失败恢复一致。
- 这样可以在 hook 层编写融合成功/失败/不可用条件的单元测试，减少 UI 集成测试负担。

实现边界：

- `useQueuedSend` 新增：
  - `fuseQueuedMessage(threadId: string, messageId: string): Promise<void>`
  - `canFuseActiveQueue: boolean`
  - `fusingMessageIdByThread` 或等价 thread-local fusion lock
- `useComposerController` 负责把 hook 暴露为 composer 可消费的回调。
- `MessageQueue` 仅增加 `onFuse`、`canFuse` 与按钮渲染。

### Decision 3: 融合动作不改变默认 collaboration mode，只覆盖本次即时 follow-up 的发送上下文

- 方案 A：点击融合时同步修改当前线程的 UI mode/default mode。
- 方案 B：保留当前线程的默认 mode，仅对这一次发送复用当前已解析的 codex collaboration payload。

采用 B。

原因：

- 用户要的是“把这条排队消息并入当前回答”，不是“顺手改默认模式”。
- 修改默认 mode 会制造隐式副作用，容易影响后续普通发送，违背提案“保持原有产品语义不变”的边界。
- `withCodexCollaborationMode` 已有能力在发送时附带当前线程 mode，可直接复用。

防御性思考：

- 如果当前活动引擎不是 Codex，则不显示或禁用 `融合`，避免出现“像 steer，但其实只是普通 resend”的伪语义。
 
修正：

- 融合入口是否可用应由“当前线程/当前引擎是否支持该运行态”决定，而不是由“是否是 Codex”单独决定。
- Codex 只是当前参考语义来源，不应把共享 queue UI 设计成硬编码的 Codex-only 表面。

### Decision 4: 视觉上采用“统一外框 + 内层子卡片 + 操作区分栏”，不把队列并入 textarea 本体

- 方案 A：把排队项直接塞进输入框内部，形成单一大容器。
- 方案 B：保留“队列区在上、输入区在下”的层次，但通过共享圆角、边框、背景和间距把它们做成一个组合容器。

采用 B。

原因：

- 当前 composer 结构已经清晰区分 header/attachments/input/button area，直接嵌进 textarea 风险高，容易破坏 resize、focus-within 和附件区域布局。
- 组合容器更容易在现有 CSS 基础上渐进升级，也更利于窄宽度下保持稳定。
- 这能满足“风格一致”而不触碰输入控件的底层排版。

具体策略：

- 队列区外层采用与 `.composer-input` 对齐的 border token 与圆角基线。
- 每条队列 item 使用更轻一级的子卡片视觉，并在右侧预留 `融合`、`删除` 动作位。
- 通过 token 而不是硬编码色值完成深浅主题适配。

### Decision 5: 队列项融合采用“线程级融合锁 + 乐观移除 + 原索引回滚”

- 方案 A：等待全部完成后再从 UI 队列移除。
- 方案 B：只保护被点击的 `messageId`，让 auto-drain 继续跑。
- 方案 C：点击后先在本地把该项从队列取出，同时为该线程加 fusion lock；融合未决期间暂停同线程 auto-drain；失败按原索引插回。

采用 C。

原因：

- 用户点击“融合”后的预期是“这条消息已经被升级处理”，不是继续留在列表里像没反应。
- 当前队列自动 drain 也是状态前移模型，保持同类交互一致更自然。
- 仅保护 `messageId` 不够，因为 auto-drain 是按线程队列头部消费；融合未决期间继续 drain 会导致下一条消息抢跑。

代价：

- 需要在 `useQueuedSend` 内额外保留原索引、线程级 fusion lock 与临时 in-flight fusion 状态。
- 需要让 auto-drain effect 在 fusion lock 存在时整线程暂停，而不是只跳过单个 id。

约束：

- 融合中的线程必须被标记为“暂停 auto-drain”，直到融合成功或失败。
- 失败回滚必须恢复到点击前的相对位置，而不是简单 prepend/append。

### Decision 6: 融合必须保留完整 queued payload，而不是退化成纯文本 resend

- 方案 A：融合时只发送文本内容。
- 方案 B：融合时保留 `text + images + sendOptions` 的完整 payload。

采用 B。

原因：

- 当前队列项并不只有文本，还承载图片、memory 选择、agent 选择、access mode 和 collaboration payload 等逐条发送参数。
- 如果融合丢掉这些字段，用户看到的是“同一条队列项”，系统执行的却是另一条降级请求。

约束：

- 融合发送 MUST 复用原始队列项的 `text`、`images` 和 `sendOptions`。
- 若当前引擎对某类 payload 不支持，应在入队前就保持与普通发送一致的约束，而不是在融合时静默丢弃。

## Risks / Trade-offs

- [Risk] 融合流程与队列自动出队 effect 竞争，导致消息重复发送或顺序错乱
  → Mitigation：在 `useQueuedSend` 增加线程级 fusion lock；同线程融合未决期间暂停 auto-drain。

- [Risk] 中断成功但即时发送失败，用户误以为消息已并入当前作答
  → Mitigation：失败时原位回滚，并显示明确错误提示；按钮在请求中显示 loading/disabled。

- [Risk] 视觉统一改动误伤现有 composer 头部布局、附件区或 focus ring
  → Mitigation：限制样式作用域在 queue/composer header 区域，避免直接改 textarea/container 的核心布局属性。

- [Risk] 共享 queue UI 被误做成 Codex-only，或非支持运行态出现“看起来能融合”的假交互
  → Mitigation：`canFuseActiveQueue` 必须由引擎/线程运行态联合裁决；是否展示和是否可点都由 runtime capability 决定。

- [Risk] 融合时丢失图片或逐条发送参数，造成隐式降级
  → Mitigation：spec 和任务必须明确要求 payload 保真；测试覆盖 `images` / `sendOptions` 保持一致。

- [Risk] React 组件继续膨胀，导致 `MessageQueue` 或 `useComposerController` 复杂度失控
  → Mitigation：把融合状态机留在 `useQueuedSend`，UI 组件只接收显式 props；必要时拆出 queue action 子组件。

## Migration Plan

执行顺序采用“先隐藏能力、后暴露 UI”的稳态 rollout：

1. 先在 `useQueuedSend` 内落地融合状态机、线程级 fusion lock、payload 保真和 runtime capability 判定，但暂不暴露任何新 UI。
2. 补齐 hook 级自动化测试，先锁住 steer 主路径、safe cutover fallback、失败回滚和 auto-drain 暂停，确保状态机独立可证。
3. 将 `interruptTurn` 能力从 `useThreads -> app-shell` 接到 `useComposerController`，仅供 safe cutover fallback 使用；这一阶段仍不开放用户可见按钮。
4. 在 controller/composer props 层透传融合回调、loading/disabled 态和 capability flag，形成完整但默认隐藏的接线闭环。
5. 当前三步全部通过 typecheck + hook/integration 测试后，再改造 `MessageQueue` 结构和样式，开放 `融合` 按钮。
6. 最后一批补 UI 组件测试、i18n 和样式回归测试，确认不会因按钮曝光引入误触或伪可用状态。
7. 全部目标测试和 `openspec validate --strict` 通过后，再进入 apply 验收。

回滚策略：

- 若融合状态机出现重复发送、顺序错乱或 fallback 误触 interrupt，优先回滚到“隐藏融合能力”的中间态，仅保留内部接线与测试资产，不开放 UI。
- 若 UI 暴露后出现误用或视觉/交互回归，再回退到“只有删除按钮”的旧行为，状态机代码可继续保留在未启用态。
- 因本提案不涉及数据迁移和 Rust 协议，所以回滚只需回退前端组件和 hook 改动。

### Implementation Gates

- Gate A: 状态机门禁
  - `useQueuedSend` 融合能力已实现，但 UI 不可见。
  - 必须通过：steer 主路径、safe cutover fallback、失败回滚、同线程 auto-drain 暂停测试。
- Gate B: 接线门禁
  - `interruptTurn` fallback 已贯通到 `useComposerController`，但 UI 仍不可见。
  - 必须通过：controller/app-shell 集成测试，无新增跨线程串扰或重复发送。
- Gate C: 曝光门禁
  - `MessageQueue` 按钮和样式开放。
  - 必须通过：UI 测试、i18n 检查、样式回归、不可用态不伪成功。

## Open Questions

- `融合` 按钮在文案上是否只使用中文“融合”，还是需要同时给英文 locale 提供更接近 `Guide` / `Steer` 的术语映射。
- 当线程处于 processing=true 但 runtime 已接近结束瞬间时，是否允许“检测到 run 已结束后直接 immediate send”作为第三种轻量 fallback。当前设计先保持两段式：优先 in-run follow-up，其次 safe cutover。
