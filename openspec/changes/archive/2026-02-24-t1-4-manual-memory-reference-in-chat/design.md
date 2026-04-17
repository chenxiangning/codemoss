# Design: T1-4 Manual Memory Reference in Chat

## Context

当前发送链路在 `useThreadMessaging.ts` 中会调用 `injectProjectMemoryContext(...)` 进行自动注入，开关由
`projectMemory.contextInjectionEnabled` 控制。该策略在真实使用中会出现“命中不准但仍注入”的噪声问题。
同时，实时对话渲染链路出现了多类质量问题：思考模块在流式阶段重复或丢失、正文在 CJK 输出中出现逐字断行、历史回放与实时内容不一致、以及
pending 会话在弱证据场景被误归并导致新会话残留。
在记忆回写环节，还出现了摘要与正文重复落库（detail 重复）以及旧会话遗留注入前缀未转摘要卡片（历史样式回退）的问题。

本设计将记忆消费模式调整为“手动选择优先”：

- 自动注入路径关闭
- 用户通过 Composer 输入 `@@` 主动选择项目记忆
- 仅在本次发送注入一次，并在发送后清空
- `@@` 选择器改为“可读可比可预览”的交互，而非单一简化下拉
- 同步收敛实时/历史消息渲染与线程事件归并，保证展示一致性

相关模块：

- 发送链路：`src/features/threads/hooks/useThreadMessaging.ts`
- 注入工具：`src/features/project-memory/utils/memoryContextInjection.ts`
- Composer 自动补全：`src/features/composer/hooks/useComposerAutocomplete.ts`、`useComposerAutocompleteState.ts`
- UI 设置面板：`src/features/project-memory/components/ProjectMemoryPanel.tsx`
- 消息渲染：`src/features/messages/components/Messages.tsx`、`src/features/messages/components/Markdown.tsx`
- 历史规整：`src/utils/threadItems.ts`
- 事件与线程收敛：`src/features/app/hooks/useAppServerEvents.ts`、`src/features/threads/hooks/useThreads*.ts`

## Goals / Non-Goals

**Goals:**

- 将对话记忆消费从自动注入切换为手动 `@@` 关联。
- 确保 `@@` 支持多选，并在发送时 one-shot 注入。
- 将“上下文注入”开关固定为关闭且禁用，避免误触旧策略。
- 保持现有 `@` 文件引用能力不回退。
- 修复实时与历史展示中的“重复、断裂、丢思考”问题。
- 降低 completion 双发与 pending 错归并引发的消息残留风险。
- 消除项目记忆 detail 的摘要/正文重复内容。
- 兼容旧会话注入前缀并统一为摘要卡片展示。

**Non-Goals:**

- 不改后端存储模型与 API schema。
- 不改自动采集（auto capture）能力。
- 不引入向量检索或新的相关性算法。
- 不变更后端事件协议，只在前端消费层做兼容与去重。

## Decisions

### Decision 1: 自动注入策略改为硬关闭（Hard Off）

- 方案 A：保留开关，默认 false，但允许用户再次开启。
- 方案 B：移除开关并删除相关 UI。
- 方案 C：保留 UI 文案但禁用交互，发送链路硬关闭自动注入。**（选择）**

**选择理由**：

- 兼顾产品可解释性（用户仍能看到该能力状态）与行为确定性（无法误开启）。
- 对现有代码入侵小，回滚成本低。

### Decision 2: `@@` 作为新触发语义，单 `@` 保持文件引用

- 方案 A：复用 `@`，在同一列表混合文件与记忆。
- 方案 B：新增 `@@` 记忆触发，保留 `@` 文件触发。**（选择）**

**选择理由**：

- 避免与现有文件引用冲突。
- 用户心智更清晰，记忆与文件引用语义分离。

### Decision 3: 记忆选择状态放在 Composer 层，发送后清空

- 方案 A：把选择状态存到全局 store，可跨会话复用。
- 方案 B：存 Composer 本地状态（按当前会话生效），发送后清空。**（选择）**

**选择理由**：

- 满足 one-shot 注入要求。
- 降低跨线程/跨工作区状态污染风险。

### Decision 4: 注入块格式沿用 `<project-memory>`，仅变更 source

- 方案 A：引入新格式（JSON 或新标签）。
- 方案 B：沿用现有 XML block，source 标记为 `manual-selection`。**（选择）**

**选择理由**：

- 兼容现有消息清洗与显示逻辑（`threadItems.ts`）。
- 最小化对后续解析链路影响。

### Decision 5: `@@` 选择器采用“双区结构（候选列表 + 详情预览）”

- 方案 A：保留当前简化 select（仅标题/弱摘要）。
- 方案 B：单列列表 + 点击后二次弹窗看详情。
- 方案 C：同层双区（左候选、右详情）或等价内联展开。**（选择）**

**选择理由**：

- 选择决策依赖上下文细节，必须在同一操作流中“先看后选”。
- 减少“先选中再后悔移除”的来回操作，提升多选效率。
- 更适配未来的排序、过滤、批量选择与键盘导航扩展。

### Decision 6: 思考模块采用“引擎差异化可见性 + 相邻去重”

- 方案 A：仅在有正文时显示思考，title-only 直接隐藏。
- 方案 B：全部思考 raw 渲染，不做筛选。
- 方案 C：Codex 保留 title-only 实时思考；其他引擎保留最近一条 title-only，并做相邻去重。**（选择）**

**选择理由**：

- 兼顾实时可见性与页面噪声控制。
- 直接针对“思考丢失”和“思考重复堆叠”两个回归点。

### Decision 7: 文本稳定化采用“多阶段规整”而非单点替换

- 方案 A：只在 Markdown 层做一次清洗。
- 方案 B：只在 reducer 合并 delta 时做处理。
- 方案 C：reducer + message parse + markdown/history 逐层轻量规整。**（选择）**

**选择理由**：

- 流式数据在不同阶段表现不同（增量、快照、历史回放），单点难覆盖全部异常。
- 通过“逐层小步去重/合并”降低误判和破坏 Markdown 结构的概率。

### Decision 8: pending 线程解析采用“活动证据优先”，禁止时间戳猜测

- 方案 A：多 pending 时按最新时间戳猜测。
- 方案 B：仅按 active thread 猜测。
- 方案 C：仅在 processing/turn/content 等活动证据存在时归并；无证据返回 null。**（选择）**

**选择理由**：

- 避免新会话串线与旧输出残留。
- 与“宁可不归并也不误归并”的稳定性目标一致。

### Decision 9: 记忆写入采用“摘要归一 + 正文增量”策略

- 方案 A：只在展示层去重，不改写入内容。
- 方案 B：在写入前做句级去重与重叠裁剪，`助手输出`仅保留相对摘要的新增内容。**（选择）**

**选择理由**：

- 从数据源头消除重复，避免不同渲染层重复修补导致行为分叉。
- 保持记忆 detail 可读性，降低“摘要与正文重复两遍”的噪声。

### Decision 10: 旧会话注入前缀做兼容解析并映射摘要卡片

- 方案 A：仅识别新格式 `【记忆上下文摘要】`。
- 方案 B：兼容识别用户消息中的旧前缀（`[对话记录]...`、`<project-memory>...</project-memory>`），统一映射到摘要卡片。**（选择）
  **

**选择理由**：

- 解决“旧 session 点击后样式回退”的历史兼容问题。
- 兼容层在展示端完成，不改历史数据，不引入迁移成本。

## Interaction Model (UI/UX)

### 触发与布局

- 在 Composer 输入 `@@` 后打开记忆选择器。
- 候选区展示高信息密度卡片（标题、摘要片段、kind、优先级、更新时间、标签）。
- 详情区展示当前高亮候选的完整内容/长摘要/关键元信息。

### 选择与反馈

- 点击候选即可选中/取消，多选去重。
- 已选项在候选区与 Composer 区域均有显式状态（checkbox/chip/计数）。
- 支持“只浏览不选择”，查看详情不应改变选择结果。

### 一致性与可访问性

- 键盘可完成完整流程：上下移动、空格选择、回车确认、Esc 关闭。
- 长文本默认折叠并支持展开，避免遮挡输入区。
- 空状态、搜索无结果、加载失败状态要有明确文案。

## Risks / Trade-offs

- [Risk] 用户需要额外操作才有记忆注入 → Mitigation: `@@` 触发 + 搜索 + 多选，降低操作成本。
- [Risk] 候选信息过多导致视觉负担 → Mitigation: 卡片信息分层（主信息/次信息），详情区承载完整文本。
- [Risk] 详情预览引入交互复杂度 → Mitigation: 保留默认简洁态，按需展开详情，提供键盘/鼠标一致行为。
- [Risk] `@@` 触发误判影响 `@` 文件补全 → Mitigation: 在 autocomplete 解析层加双触发优先判定与回归测试。
- [Risk] one-shot 状态清理时机不一致（发送失败/重试） → Mitigation: 在发送收敛点统一清理，并覆盖失败路径测试。
- [Risk] 现有依赖 localStorage 的旧行为残留 → Mitigation: 发送链路忽略该值，UI 开关禁用且固定关闭。
- [Risk] 文本规整规则误伤正常 Markdown → Mitigation: 对 code fence/list/table/blockquote 做保护分支并补充回归测试。
- [Risk] 去重策略过强导致信息损失 → Mitigation: 仅对相邻重复或高相似重复生效，并优先保留更高可读版本。
- [Risk] 多层规整带来维护复杂度上升 → Mitigation: 把规则按职责拆分（reducer/render/history）并以测试锁定行为。
- [Risk] 记忆写入去重过强可能丢失信息 → Mitigation: 先归一摘要，再以“摘要之外增量”填充助手正文，仅裁剪高重叠片段。
- [Risk] 旧前缀兼容误判普通文本 → Mitigation: 增加严格前缀与字段关键字匹配（用户输入/助手输出摘要/助手输出）并补充回归测试。

## Migration Plan

1. **Phase 1（行为收敛）**
    - 发送链路关闭自动注入。
    - 设置面板“上下文注入”开关置灰禁用并默认关闭。
2. **Phase 2（手动能力上线）**
    - Composer 增加 `@@` 触发候选、多选状态展示。
    - 发送时注入已选记忆并 one-shot 清空。
3. **Phase 3（选择器体验升级）**
    - 候选区升级为高信息密度卡片。
    - 增加详情预览交互与可访问性支持（键盘、状态文案、空态）。
4. **Phase 4（流式渲染稳定化）**
    - reducer 合并策略增加重复裁剪与碎片合并。
    - Messages/Markdown/threadItems 对实时和历史输出做一致化规整。
5. **Phase 5（事件与线程归并收敛）**
    - `item/completed` 与 `turn/completed` completion 去重。
    - pending 线程解析改为活动证据优先，移除时间戳猜测。
6. **Phase 6（验证与回归）**
    - 补充单测与集成测试：`@@` 触发、`@` 不回退、one-shot 注入清空、思考可见性、正文去重、pending 归并判定。
    - 补充历史兼容与记忆写入回归：旧前缀摘要卡片映射、记忆 detail 去重。

**Rollback Strategy**

- 可在前端恢复旧注入调用与开关可交互逻辑（仅前端回滚，不涉及数据迁移）。

## Open Questions

1. `@@` 候选列表默认展示数量上限（20/50）是否按工作区规模动态调整？
2. 详情区默认展开阈值是否按语言类型（CJK/Latin）差异化配置？
3. 文本规整规则是否需要提供调试开关（仅开发环境）用于快速定位误判？
4. 旧注入前缀兼容策略是否需要在后续版本增加“可观测日志”以评估命中率与误判率？
