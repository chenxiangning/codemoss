# Proposal: T1-4 Manual Memory Reference in Chat

## Why

当前“对话记忆上下文自动注入”在相关性命中上存在噪声，导致注入内容与用户当次意图不稳定匹配。为了把控制权交还给用户，需要从“自动注入”切换为“用户在聊天时主动关联记忆并单次注入”。
另外，现有 `@@` 候选选择器信息密度过低，用户在选择前看不到足够细节，难以判断是否应当引用该记忆，导致可用性不足。
同时，近期实时对话链路暴露出多类可见性问题：思考块在流式阶段会重复或丢失、正文在 CJK 场景出现“逐字断行”与重复拼接、历史回放与实时呈现不一致，以及
pending 会话归并过于激进导致新会话偶发残留旧输出。若仅改 `@@` 入口而不修复渲染与事件链路，实际体验仍不可用。
另外，在项目记忆写入链路中存在“摘要与助手正文重复落库”的问题，导致 detail 区域出现重复段；旧会话中遗留的用户侧注入前缀（
`[对话记录]...` 或 `<project-memory>...</project-memory>`）也未被统一渲染为摘要卡片，造成历史样式不一致。

## 目标与边界

- 目标：禁用自动注入路径，改为 `@@` 触发的手动记忆关联流程。
- 目标：记忆关联支持多选，并仅在本次发送生效（one-shot injection）。
- 目标：项目记忆设置面板中的“对话记忆上下文注入”改为默认关闭且置灰不可点击。
- 目标：重设计 `@@` 记忆选择器 UI/UX，使用户在选择前可查看关键细节与上下文。
- 目标：修复实时与历史消息渲染中的重复/断裂/错位问题，保证思考与正文呈现一致且可读。
- 目标：收敛线程事件与 pending 归并策略，避免 completion 重复注入与新会话残留。
- 目标：修复项目记忆 detail 的重复写入问题，保证“助手输出摘要”与“助手输出”语义分离。
- 目标：兼容旧会话注入前缀并统一渲染为“记忆上下文摘要”卡片，避免历史会话样式回退。
- 边界：本次不调整记忆存储结构与记忆打分算法。
- 边界：不变更后端事件协议与线程持久化模型，仅在前端消费层做稳定化。

## 非目标

- 不改造项目记忆自动采集（auto capture）能力。
- 不引入新的后端检索算法或向量召回。
- 不改变现有 `@` 文件引用能力语义。
- 不新增“全自动记忆选择”回退模式。

## What Changes

- 关闭消息发送前的自动记忆注入流程；未手动选择记忆时，不注入任何记忆块。
- 在 Composer 输入 `@@` 时弹出“当前项目记忆”候选列表，支持搜索与多选。
- 将候选从“单一列表/弱信息”升级为“高信息密度卡片 + 详情预览”交互，至少展示：标题、摘要片段、kind、优先级、更新时间、标签。
- 支持“当前高亮项详情预览区”（或等价二级详情面板），用于在不离开 Composer 的情况下查看记忆细节后再决定是否选择。
- 用户确认选择后，所选记忆在当次发送时注入一次；发送完成后清空本次选择。
- 项目记忆设置中的“启用对话记忆上下文注入”固定为关闭态，并置灰禁用（不可切换）。
- Composer 增加“本次已关联记忆”条带（chip strip），支持发送前移除已选记忆，并将 `selectedMemoryIds` 透传到
  send/queue/new-thread/kanban 链路。
- 侧边栏新增“项目记忆”入口并对齐导航位置，右侧 Memory 面板保持可直接打开。
- 统一实时与历史文本规范化：对思考块与正文做碎片段落合并、重复段落/句子去重、标题前缀重叠裁剪，减少“逐字断行”和“整段回声”。
- 优化思考块可见性策略：Codex 保留实时 title-only 思考行；非 Codex 保留最近一条 title-only 思考行，避免“思考模块突然消失”。
- 调整 app-server 事件收敛：`item/completed` 与 `turn/completed` 之间增加去重护栏，避免 assistant completion 双发。
- 收紧 pending 会话解析：仅在存在 processing/turn/content 证据时归并，不再用“最新时间戳猜测”，降低新会话串线风险。
- 统一思考 icon 视觉语义为绿色，减少不同来源显示不一致。
- 在 `useThreads` 的记忆归并写入路径增加摘要/正文规范化与句级去重：摘要只保留去重后的主信息，`助手输出`仅保留相对摘要的新增内容，避免
  detail 重复。
- 在 `Messages` 增加旧格式前缀兼容解析：用户消息若带历史注入前缀（`[对话记录]...` 或
  `<project-memory>...</project-memory>`），应渲染为摘要卡片并保留真实用户输入正文。

## 技术方案对比

### 方案 A：保留自动注入，仅优化算法阈值

- 优点：改动面小。
- 缺点：核心问题仍在“系统替用户决策”，可解释性与可控性不足。

### 方案 B：完全切到手动 `@@` 关联（本次选择）

- 优点：用户可控、可预期；上下文来源明确；降低无关注入。
- 缺点：多一步用户操作，需要输入层支持新交互。

**取舍**：选择方案 B。当前优先保证注入质量与可控性，而不是“零操作自动化”。

### 方案 C：`@@` 继续使用简化 select（当前体验）

- 优点：实现成本最低。
- 缺点：候选可读性差、难以比较、选择决策成本高，实际可用性不达标。

### 方案 D：`@@` 采用“候选卡片 + 详情预览”选择器（本次追加）

- 优点：选择前可见上下文细节，降低误选和反复试错；对多选场景更友好。
- 缺点：前端交互复杂度增加，需要补充可访问性与键盘交互测试。

**追加取舍**：在保持手动 one-shot 策略不变的前提下，采用方案 D 重做选择器体验。

### 方案 E：仅修 `@@`，不触及消息渲染链路

- 优点：变更范围可控，交付快。
- 缺点：实时对话仍会出现重复与断裂，用户体感上仍是“不可用”。

### 方案 F：`@@` + 渲染/事件稳定化一并落地（本次执行）

- 优点：一次性打通“选择 -> 注入 -> 流式展示 -> 历史回放”全链路一致性。
- 缺点：前端 reducer 与渲染层改动面较大，需要补足回归测试。

**稳定化取舍**：选择方案 F。当前优先修复可见质量问题与会话一致性，再考虑进一步简化实现。

## Capabilities

### New Capabilities

- `composer-manual-memory-reference`: Composer 支持 `@@` 触发项目记忆候选、多选、一次性注入。
- `composer-manual-memory-ux`: 记忆候选卡片 + 预览面板 + 已选条带的闭环交互。

### Modified Capabilities

- `project-memory-consumption`: 从“自动注入”改为“仅手动选择后注入”。
- `project-memory-ui`: 上下文注入开关改为默认关闭并禁用（置灰不可点击）。
- `chat-stream-rendering`: 流式正文/思考去重与碎片合并，实时与历史一致化。
- `thread-event-reconciliation`: completion 事件去重与 pending 线程解析收敛。

## 验收标准

- 在聊天输入框输入 `@@` 时，能弹出当前 workspace 的项目记忆候选。
- 候选列表应可直接看到关键摘要与元信息（而非仅标题）。
- 用户无需先选中即可查看候选细节（预览区或等价详情交互）。
- 候选支持多选；选中后发送消息时仅注入这批记忆一次。
- 未选择记忆时发送消息，不发生任何记忆注入。
- 发送后本次记忆选择被清空；下次发送需重新选择。
- 项目记忆设置中的“上下文注入”开关默认关闭、UI 置灰、用户无法点击切换。
- 实时思考区在快速流式更新下不重复堆叠；非 Codex 不再出现思考区异常消失。
- 思考摘要与正文出现重叠时应自动去重，不得出现“同句重复两次以上”。
- CJK 断裂文本（逐字换行/逐段换行）应自动合并为可读句段；Markdown 列表/代码块结构不得被破坏。
- `item/completed` 已发出 assistant 文本后，`turn/completed` fallback 不得再次追加同文。
- 多 pending 会话且无活动证据时不应盲目归并；新建会话不应出现旧会话输出残留。
- 历史回放与实时结果在同一条消息上保持一致（不新增重复块）。
- 旧会话中用户消息若包含历史注入前缀，界面应显示“记忆上下文摘要”卡片，且用户气泡正文仅展示真实输入文本。
- 项目记忆 detail 中“助手输出摘要”与“助手输出”不得出现整段重复；当输出与摘要重复时，`助手输出`段应省略或仅保留新增片段。
- 相关测试覆盖：`@@` 触发、多选注入、one-shot 清空、禁用自动注入、开关禁用态、思考稳定显示、正文去重、completion 去重、pending
  归并判定。

## Impact

- 前端聊天发送链路：`src/features/threads/hooks/useThreadMessaging.ts`
- Composer 自动补全与建议：`src/features/composer/hooks/useComposerAutocomplete*.ts`
- Composer 展示层：`src/features/composer/components/Composer*.tsx`
- 记忆候选选择器与详情预览：`src/features/composer/components/*memory*`（新增或改造）
- 项目记忆设置 UI：`src/features/project-memory/components/ProjectMemoryPanel.tsx`
- 注入工具与测试：`src/features/project-memory/utils/memoryContextInjection.ts` 及相关 tests
- 线程事件与流式收敛：`src/features/app/hooks/useAppServerEvents.ts`、`src/features/threads/hooks/useThreads*.ts`
- 消息与思考渲染：`src/features/messages/components/Messages.tsx`、`src/features/messages/components/Markdown.tsx`
- 历史项规整：`src/utils/threadItems.ts`
- 侧边导航与布局：`src/features/app/components/Sidebar*.tsx`、`src/features/layout/hooks/useLayoutNodes.tsx`
- 样式与文案：`src/styles/composer.css`、`src/styles/messages.css`、`src/styles/project-memory.css`、
  `src/i18n/locales/{zh,en}.ts`
