## Context

当前变更已完成 `Apply` 自动执行与反馈主链路，但 proposal 已扩展到更高一层的执行台 IA 与提案内聚工作流：

- 控制区要从“动作优先”改为“项目优先”；
- `项目` tab 需要信息架构重排（卡片、按钮、下拉、icon、文案）；
- `动作` tab 需要把执行引擎与动作入口统一编排；
- 新增“新提案/追加提案”弹窗流程，并复用 Apply 的实时反馈体验；
- 执行引擎在页面内只选一次，供 Apply / AI 接管 / 提案处理共用。
- 提案输入需要从基础文本域升级为图文输入（支持图片上传），以承载截图类上下文。

若不做这层同步，Artifacts 会出现“proposal 已升级、design/spec/tasks 仍停留旧粒度”的断层。

## Goals / Non-Goals

**Goals**

- 统一执行台“项目 -> 动作”信息架构与默认入口。
- 明确 `项目` 与 `动作` 两个 tab 的卡片化布局和交互职责。
- 新增提案工作流（create/append）并与现有执行反馈模型复用。
- 将执行引擎提升为页面级共享配置，减少重复选择和状态漂移。
- 统一动作编排行视觉：引擎下拉（含 icon）+ 提案入口 icon 按钮同排。

**Non-Goals**

- 不改 OpenSpec CLI 核心协议定义。
- 不绕过 `verify` / `archive` 门禁。
- 不在本轮引入跨 change 批处理或多提案并行编排。

## Decisions

### Decision 1: 控制区 IA 调整为 `project-first`

- tab 顺序固定为：`项目` 在前、`动作` 在后。
- 默认激活 tab 为 `项目`。
- 原因：用户在执行动作前，通常先确认 spec 路径与项目上下文。

### Decision 2: `项目` tab 采用双卡片结构

- 卡片 A：`SPEC 位置配置`
    - 路径输入
    - 当前生效路径展示
    - `保存路径` / `恢复默认`
- 卡片 B：`项目信息`
    - 智能体选择
    - 摘要预览
    - 更新命令
    - 自动填充并更新按钮
- 视觉约束：按钮层级、icon 语义、文案提示与间距节奏统一。

### Decision 3: `动作` tab 增加“动作编排”主卡

- 动作编排卡承载：
    - 全局执行引擎选择器（页面级唯一）
    - 提案入口（新增提案/追加提案）
- 交互布局要求：
    - 引擎下拉显示引擎 icon（触发器 + option）。
    - `新增提案` / `追加提案` 以 icon-only 按钮置于引擎下拉右侧同一行。
    - icon-only 按钮通过 tooltip + `aria-label` 提供可读语义。
- Continue/Apply/Verify/Archive 保留，但并入统一卡片体系，减少“孤立按钮块”。

### Decision 4: 提案工作流新增 create / append 两条路径

- create：点击入口 -> 弹窗图文输入提案内容（文本 + 图片） -> 交由 AI 处理并落地新 change。
- append：点击入口 -> 弹窗输入补充内容（支持文本 + 图片）+ 绑定目标旧 change -> 交由 AI 处理。
- 两条路径均走同一执行引擎路由，不再在动作内二次选引擎。

### Decision 5: 反馈层复用 Apply 执行反馈模型

提案处理过程复用“阶段化反馈浮层”能力：

1. preflight
2. proposal-input
3. ai-processing
4. artifact-write
5. finalize

每阶段统一输出：`status`、`summary`、`error`、`logs`（可选）。
完成后触发 Spec Hub runtime refresh，并尝试定位相关 change。

### Decision 6: 提案弹窗输入升级为 Rich Composer

- 输入区形态采用更大可编辑区域（类 chat composer 交互），替代紧凑基础 textarea。
- 支持至少一种显式图片上传入口，并兼容粘贴/拖拽图片（若宿主能力允许）。
- 处理前进行输入校验：空文本且无图片时不可提交；非法类型/超限时给出即时错误。

## Architecture Sketch

- `SpecHub`（UI）
    - `activeControlTab` 默认 `project`
    - `selectedExecutionEngine` 页面级状态（project/actions 共用）
    - 动作编排行：`engine-select(with icon)` + `create-btn(icon)` + `append-btn(icon)`
    - 提案弹窗（rich composer：文本 + 图片、append 时选择 target change）
    - 复用执行反馈浮层组件（来源可区分 apply/proposal）

- `useSpecHub`（runtime orchestration）
    - `setExecutionEngine(engine)`
    - `runApplyExecution(...)`（沿用）
    - `runProposalFlow({ mode: create | append, targetChange?, content, attachments?, engine })`（新增）
    - `refresh()` 后返回 change 定位信息

- `OpenSpec adapter`
    - 统一接收 `{ engine, mode, changeContext, content, attachments? }`
    - 执行 AI 提案处理
    - 回传结构化反馈 envelope（phase + summary + logs + resolvedChange）

## Risks / Trade-offs

- 风险：全局引擎选择导致误解“动作级可单独覆盖”
    - 缓解：在动作区和反馈卡都显式展示当前 engine。
- 风险：append 目标 change 误选
    - 缓解：弹窗强制展示选中 change 标识与二次确认摘要。
- 风险：提案处理时长拉长
    - 缓解：阶段反馈可观测，失败给出重试/切换引擎建议。
- 风险：图片上传导致大 payload 与处理延迟
    - 缓解：限制单图/总大小与类型，上传前预检并在 UI 提示。

## Migration Plan

1. 同步 UI spec：tab 顺序、默认 tab、卡片重排、提案入口与弹窗、动作编排行同排布局。
2. 同步 runtime spec：共享引擎状态、提案执行状态机、图文输入状态、完成后 refresh 与定位。
3. 同步 adapter spec：新增提案 create/append 调用契约、图片附件字段与反馈 envelope。
4. 更新任务清单，新增 IA/UX 与提案流程实现项。

## Open Questions

- append 模式下 target change 默认值是否取“当前选中 change”？
- 提案反馈浮层是否允许在后台运行并最小化？
- 提案完成后定位策略是否优先“新建/被追加 change”，还是保留当前选中并提供跳转入口？

---

## Addendum (2026-02-25): Verify Optional Auto-Completion

### Incremental Context

当前 `验证` 动作已稳定执行 `openspec validate <change-id> --strict`，但当 `verification`
产物缺失时，用户需要手动跳转补全流程。  
为降低操作跳转成本，同时保持默认行为稳定，本轮增量引入“可选补全”而非“强制补全”。

### Decision A1: Verify 保持默认直通语义

- 在 `动作` 面板 `验证` 按钮旁新增复选框（建议文案：`自动补全`）。
- 默认未勾选。
- 未勾选时，`验证` 流程与现状完全一致：直接执行 strict validate，不引入额外步骤。

### Decision A2: 勾选后启用前置补全编排

- 勾选状态下触发 `验证` 时：
    - 若 `verification` 产物已存在：直接 strict validate；
    - 若 `verification` 缺失：先执行 AI 补全 verification，再自动 strict validate。
- 补全失败时立即中止流程并给出错误反馈，禁止继续 validate。

### Decision A3: 并发与可见性约束

- `验证` 执行期间，复选框进入禁用态，防止重复点击和中途切换。
- 运行态反馈需可区分当前处于 `completion` 还是 `validate` 阶段，避免误判“卡住”。

### Architecture Delta

- `SpecHub`（UI）
    - 新增 `verifyAutoCompleteEnabled` 本地状态（默认 `false`）。
    - `验证` 行展示 checkbox，并在 `isRunningAction !== null` 时禁用。
- `useSpecHub`（runtime orchestration）
    - 新增 `executeVerify({ autoComplete: boolean })` 分支编排。
    - 当 `autoComplete=true` 且缺失 verification 时，先触发补全子流程，再调用既有 `runSpecAction(verify)`。
- `OpenSpec adapter`
    - 补全阶段复用现有 AI 执行能力与共享引擎路由，返回结构化阶段结果（成功/失败 + 输出摘要）。

### Risk Update

- 风险：用户误以为“验证总会自动补全”
    - 缓解：默认关闭 + 复选框文案明确 + 失败提示显式说明当前开关状态。
- 风险：补全阶段失败导致用户不清楚下一步
    - 缓解：错误信息包含“补全失败，未执行 strict validate”及建议动作（重试/关闭开关直接验证）。

---

## Addendum (2026-02-25): Verify Auto-Completion Realtime Overlay Reuse + Draggable Positioning

### Incremental Context

当前 `验证自动补全` 仅通过动作卡片内文案反馈，缺少与 Apply/提案一致的阶段化可观测信息。  
同时反馈容器默认固定右下角，无法避免对关键区域的遮挡。

本增量将 `验证补全` 合并到统一反馈弹窗模型，并补齐拖拽交互能力。

### Decision B1: Verify 补全复用统一反馈弹窗模型

- 复用现有 Apply/提案反馈弹窗结构（状态、阶段、输出、日志、错误、摘要）。
- 触发条件：仅在 `verify + autoComplete=true + verification 缺失` 时开启补全反馈弹窗链路。
- 非触发条件：`autoComplete=false` 或 `verification 已存在`，维持现有验证路径。

### Decision B2: Verify 补全引入阶段化状态

新增 verify-completion 相关阶段枚举：

1. `completion-dispatch`
2. `completion-execution`
3. `completion-finalize`
4. `verify-dispatch`
5. `verify-finalize`

约束：

- `completion` 失败时不得进入 `verify-dispatch`。
- 失败文案需明确“strict validate skipped”语义，避免误判。

### Decision B3: 反馈弹窗支持拖拽（默认右下）

- 弹窗默认锚点保持右下角（向后兼容当前布局）。
- 标题区可拖拽，运行中与完成态均可移动。
- 关闭弹窗后重置为默认锚点，避免旧位置信息跨会话污染。
- 拖拽应为纯 UI 行为，不影响运行态与事件订阅。

### Architecture Delta

- `SpecHub`（UI）
    - 抽象统一反馈弹窗能力供 Apply/Proposal/Verify-Completion 共用。
    - 新增 verify-completion 的反馈数据绑定与阶段渲染。
    - 反馈弹窗增加 drag handlers（pointer down/move/up）与位置状态。
- `useSpecHub`（runtime orchestration）
    - 暴露 verify-completion 分阶段运行态（phase/status/logs/summary/error）。
    - 串联 completion 成功后 verify 执行；completion 失败时短路并返回失败态。
- `OpenSpec adapter`
    - 补全阶段输出沿用统一 envelope（engine/phase/output/log/error），供弹窗实时渲染。

### Risk Update (Incremental)

- 风险：多种流程复用同一弹窗导致状态串线
    - 缓解：运行 key（apply/proposal/verify-completion）隔离，切换时显式 reset。
- 风险：拖拽在窄屏导致弹窗移出可视区
    - 缓解：拖拽边界限制在可视区域内，释放时执行 clamp。
- 风险：用户误解“补全失败但 validate 未执行”
    - 缓解：失败态摘要固定包含 `validate skipped` 明示字段。

---

## Addendum (2026-02-25): Continue AI Enhancement (Read-Only) + Apply Handoff

### Incremental Context

当前 `继续` 动作能够产出 OpenSpec 指引，但用户仍需手动把长文本指引转译成可执行计划，再进入 `执行`。  
本增量在不改变 `继续` 默认语义的前提下，提供可选 `AI 增强`，并把增强结果作为 `执行` 的可控上下文输入，降低重复沟通和上下文丢失。

### Decision C1: Continue 增加可选 AI 增强开关（默认关闭）

- 在 `继续` 动作区域新增复选框（建议文案：`AI 增强`）。
- 默认不勾选，保持现有行为：仅运行 `openspec instructions specs --change <id>`。
- 勾选后执行双阶段：
    1. 运行 OpenSpec 指令获取原始 guidance；
    2. 基于 guidance + 当前变更上下文触发 AI 只读分析，产出结构化简报。

### Decision C2: AI 增强链路强制只读（No Mutation Contract）

- AI 调用必须使用 `read-only` access mode。
- Prompt 必须显式声明：禁止写文件、禁止改任务状态、禁止执行任何落盘操作。
- 该链路不得复用 `apply` 的任务回写逻辑，不得触发 `tasks.md` 自动勾选。
- 若检测到异常写入迹象，流程应标记失败并提示回退为普通 `继续`。

### Decision C3: 定义 Continue Brief 结构化协议

Continue AI 增强产物采用结构化简报（Execution Brief），建议最小字段：

- `summary`: 一句话摘要
- `recommended_next_action`: 推荐下一步（`apply` / `verify` / `archive` / `manual-review`）
- `suggested_scope`: 建议修改范围（文件/产物列表）
- `risks`: 风险点列表
- `verification_plan`: 验证建议列表
- `execution_sequence`: 建议执行顺序（步骤数组）

约束：

- 不包含任何“已执行写入”语义；
- 可缺省字段需有稳健 fallback（空数组/空字符串）。

### Decision C4: Execute 默认复用 Continue Brief（可关闭）

- 当存在“当前 change 最新 Continue Brief”时，`执行` 默认将其注入执行 Prompt 作为额外上下文。
- UI 提供显式开关（示例：`执行时复用继续AI简报`），默认开启，可随时关闭。
- 关闭后 `执行` 立即回退现有路径（仅基于 instructions/tasks/checklist），保证向后兼容。

### Decision C5: Brief 生命周期与失效策略

- Brief 按 `changeId + specRoot` 维度保存“最近一次成功结果”。
- 以下事件触发失效或降级提示：
    - 切换到其他 change；
    - `继续` 再次运行并产生更新结果；
    - 关键 artifact 更新时间晚于 brief 生成时间（提示“可能过期”）。
- 即使 brief 过期，也不得阻断 `执行`，仅给出可见提醒。

### Architecture Delta

- `SpecHub`（UI）
    - 新增 `continueAiEnhancementEnabled`（默认 `false`）。
    - 新增 `applyUseContinueBrief`（当 brief 可用时默认 `true`）。
    - 在 guidance 区展示简报摘要和“是否将用于执行”的可见状态。
- `useSpecHub`（runtime orchestration）
    - 新增 `runContinueWithOptionalAiEnhancement(...)` 编排：
        - phase-1: continue command
        - phase-2: read-only ai brief generation (optional)
    - 新增 `continueBriefByChange` 状态与读取 API。
    - `buildApplyExecutionPrompt(...)` 接受可选 `continueBrief` 输入并注入上下文段。
- `OpenSpec adapter`
    - 不新增写入型 CLI 动作；仅补充 read-only AI 分析调用契约与结构化返回。

### Risk Update (Incremental)

- 风险：用户误认为“勾选 AI 增强就会自动改代码”
    - 缓解：复选框旁文案明确“只读分析，不改文件”。
- 风险：简报质量波动误导执行
    - 缓解：保留用户可关闭“复用简报”，并在执行日志中标记是否使用简报。
- 风险：简报过期导致上下文偏差
    - 缓解：展示简报时间戳与过期提示，不阻断主流程。

---

## Addendum (2026-02-25): Post-Proposal Progressive Completion (Unblock Continue/Apply)

### Incremental Context

当前部分 change 在“仅 proposal、缺 design/specs delta/tasks”阶段会进入阻塞，导致 `继续/执行` 一并不可用。  
这会形成“缺产物 -> 无法触发补全动作 -> 持续阻塞”的死锁体验，不符合 OpenSpec 渐进式产物生成链路。

目标是把“补全动作”与“严格门禁动作”分层：  
允许用户在客户端按 `继续 -> 执行 -> 验证 -> 归档` 逐步推进，而非在 proposal 阶段被卡死。

### Decision D1: 动作门禁按“职责”而非“当前完整度”分层

- `继续` 的职责是补齐上游产物（尤其 specs/design 指引），不应被缺 `design/specs delta/tasks` 本身阻塞。
- `执行` 的职责包含补齐 `tasks` 与落地实现，不应被“缺 tasks.md”作为同类前置条件阻塞。
- `执行` 可保留最小前置（例如缺 specs delta 时先提示用户运行 `继续`）。
- `验证/归档` 保持现有严格门禁，不放宽核心质量约束。

### Decision D2: 缺产物时优先输出“推荐下一步动作”

- 在动作区缺失产物场景下，系统应优先提供 next-step 提示，而不只是罗列阻塞：
    - 缺 specs delta：提示“先继续生成 specs 指引/产物”；
    - specs 已具备但缺 tasks：提示“可执行生成 tasks 并落地实现”。
- 提示需要和动作可用性一致，避免出现“推荐执行但执行按钮不可点”的矛盾状态。

### Decision D3: 保持验证与归档门禁不变

- `验证` 仍要求验证前置完整；
- `归档` 仍要求 strict verify 通过与必需任务完成；
- 本增量仅调整 continue/apply 的可达性，不改变质量门禁终态。

### Architecture Delta

- `runtime` (`buildSpecActions`)
    - 引入“职责导向”的 action availability 计算矩阵；
    - 拆分 continue/apply 与 verify/archive 的 blocker 语义。
- `SpecHub`（UI）
    - 将缺产物 blocker 映射为可执行 next-step 提示；
    - 在 proposal-only 阶段确保 `继续` 可触发。
- `i18n/runtime text`
    - 补充“先继续再执行”等推荐文案键，避免硬编码提示。

### Risk Update (Incremental)

- 风险：门禁放宽被误读为“可跳过规范流程”
    - 缓解：仅放宽补全动作；验证/归档仍严格阻断。
- 风险：执行过早触发导致失败重试
    - 缓解：对缺 specs 场景给出明确 next-step（先继续），并保留可理解错误反馈。
