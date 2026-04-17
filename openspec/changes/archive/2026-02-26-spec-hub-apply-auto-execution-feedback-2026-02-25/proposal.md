# Proposal: Spec Hub Apply Auto Execution + Console IA & Proposal Workflow Optimization

## Why

当前变更已经把 `Apply` 从“只生成指引”升级为“可执行并有反馈”的主流程，但执行台在信息架构与操作连贯性上仍有可优化空间：

- 控制区主入口默认在 `动作`，与用户“先看项目上下文，再执行动作”的心智不一致；
- `项目` tab 目前信息密度较高，按钮、下拉、文案和卡片层级不够清晰；
- `动作` tab 缺少“提案创建/提案追加”入口，用户仍需跳出当前界面完成提案迭代；
- 执行引擎在不同动作中分散配置，增加了切换成本和误操作概率；
- 新增/追加提案动作未复用已有的实时反馈体验，处理过程可见性不足。
- 提案弹窗当前仅基础文本域，不支持图片上传，难以承载带截图的复杂需求输入。

本提案目标是在不破坏现有 Apply/Verify/Archive 主链路的前提下，完成执行台 IA 重排、项目区布局重构、动作区交互升级，以及提案工作流内聚化。

## Goals

- 将控制区 `项目/动作` 顺序对调，并默认进入 `项目` tab。
- 重构 `项目` tab 的布局层级，明确“Spec 路径配置卡”和“项目信息卡”两大区域。
- 重构 `动作` tab 结构与交互，统一动作入口组织方式。
- 新增“新提案”“追加提案”能力，均通过弹窗输入后交由 AI 执行。
- 执行引擎在本页面只选择一次，并由 Apply、AI 接管、提案动作共享。
- 新增/追加提案过程复用与 Apply 一致的实时反馈模型（运行态、阶段、输出、日志）。
- 提案输入升级为支持图片上传的富输入区，满足图文混合提案补充。
- 动作编排区采用紧凑同排布局：执行引擎下拉 + 新增提案/追加提案 icon 按钮。

## Non-Goals

- 不改变 OpenSpec CLI 协议本身。
- 不替代 `verify` / `archive` 门禁策略。
- 不引入额外 provider 或新的后端执行引擎类型。
- 不在本提案内扩展到跨 change 批处理提案编排。

## What Changes

1. 控制区 IA 调整
    - `project` tab 排到 `actions` 前。
    - `project` 作为默认 active tab。

2. `项目` tab 结构重构
    - 采用双卡片布局：
        - `SPEC 位置配置`：路径输入、当前生效路径、保存/恢复默认。
        - `项目信息`：智能体选择、预览摘要、更新命令、自动填充并更新。
    - 强化按钮、下拉、icon、文案的视觉层级与间距一致性。

3. `动作` tab 结构重构
    - 新增“动作编排”区域，统一承载执行引擎选择与提案入口。
    - 执行引擎下拉显示引擎 icon（选中态与选项态均可见）。
    - 新增提案/追加提案入口紧邻引擎下拉同排展示，采用 icon-only 按钮（保留 tooltip/可访问标签）。
    - 原有 Continue/Apply/Verify/Archive 保持可用，但融入统一卡片布局。

4. 新增提案工作流
    - 新提案：按钮触发弹窗，支持图文输入（文本 + 图片上传）后由 AI 生成/落地到新 change。
    - 追加提案：按钮触发弹窗，支持选择目标旧 change + 图文输入后追加内容。
    - 两类提案动作都复用统一执行引擎路由，不再各自独立选引擎。

5. 提案执行反馈复用
    - 提案处理过程复用 Apply 风格的反馈浮层：
        - status / phase / engine / mode
        - 实时输出流
        - 最终输出与日志
    - 执行完成后自动刷新 Spec Hub 运行态并定位到相关 change（如可识别）。

## Capabilities

### Modified

- `spec-hub-workbench-ui`
- `spec-hub-runtime-state`
- `spec-hub-adapter-openspec`

## Acceptance Criteria

1. 控制区 tab 顺序 SHALL 为 `项目` 在前、`动作` 在后，且默认显示 `项目` tab。
2. `项目` tab SHALL 使用清晰卡片分区，且 Spec 路径配置与项目信息操作可独立完成。
3. `动作` tab SHALL 提供统一执行引擎选择器，且该选择 SHALL 被 Apply / AI 接管 / 提案动作共用。
4. 系统 SHALL 提供“新增提案”“追加提案”两个入口，并通过弹窗采集输入内容。
5. 追加提案场景 SHALL 支持绑定目标 change，并将补充内容交由 AI 处理。
6. 提案处理过程 SHALL 提供与 Apply 同级别的实时反馈（运行态、阶段、输出、日志）。
7. 提案处理完成后，系统 SHALL 自动刷新 Spec Hub 状态并提供可见结果摘要。
8. 以上改造 SHALL 不破坏现有 Continue/Apply/Verify/Archive 的可用性与门禁语义。
9. 提案输入弹窗 SHALL 提供可编辑多行文本区，并支持图片上传/粘贴/拖拽（至少一种明确上传入口）。
10. 动作编排区 SHALL 以同一行呈现执行引擎下拉、新增提案按钮、追加提案按钮。
11. 执行引擎下拉与选项 SHALL 显示对应引擎 icon，新增/追加按钮 SHALL 允许 icon-only 呈现且具备可访问名称。

## Impact

- Frontend
    - `src/features/spec/components/SpecHub.tsx`
    - `src/styles/spec-hub.css`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
- Tests
    - `src/features/spec/components/SpecHub.test.tsx`
    - `src/features/spec/hooks/useSpecHub.test.tsx`（回归）

## Notes

- 该优化属于“现有 Apply 自动执行能力上的 IA 与交互增强”，与已有目标一致，不改变核心技术路线。
- 若后续需要将“提案执行结果”写入更严格的结构化协议（例如固定 JSON schema），可在下一轮补充到 design 与 tasks。

---

## Proposal Addendum (2026-02-25): Verify Optional Auto-Completion

### Why (Incremental)

当前 `验证` 动作语义是“直接执行 strict validate”，当 `verification`
产物尚未生成时，用户需要手动先走补全流程再回到验证，链路存在额外切换成本。  
我们希望在不改变既有验证语义的前提下，提供一个显式开关，让用户自行决定是否启用“自动补全后验证”。

### Incremental Changes

1. 在 `动作` 面板的 `验证` 按钮旁新增复选框（文案示例：`自动补全`）。
2. 复选框默认不勾选，默认行为保持现状：点击 `验证` 直接执行 `openspec validate <change-id> --strict`。
3. 复选框勾选后，点击 `验证` 时执行前置编排：
    - 若 `verification` 产物已存在：直接执行 strict validate；
    - 若 `verification` 产物缺失：先触发 AI 生成/补全 verification 产物，成功后自动执行 strict validate。
4. 补全失败或中断时，流程 SHALL 停止在补全阶段并显示错误，不进入 validate。
5. 动作执行期间复选框 SHALL 只读/禁用，避免状态竞争与重复触发。

### Acceptance Criteria (Incremental)

1. 系统 SHALL 在 `验证` 按钮旁提供复选框，且默认值为未勾选。
2. 未勾选时，`验证` 动作 SHALL 与当前版本行为一致（命令、门禁与结果表现不变）。
3. 勾选时，若缺失 `verification` 产物，系统 SHALL 先执行补全，再在成功后自动执行 strict validate。
4. 勾选时，若 `verification` 已存在，系统 SHALL 直接执行 strict validate，不引入额外步骤。
5. 补全失败时，系统 SHALL 给出可见错误反馈，并 SHALL NOT 继续执行 validate。

### Impact (Incremental)

- Frontend
    - `src/features/spec/components/SpecHub.tsx`
    - `src/features/spec/hooks/useSpecHub.ts`
    - `src/styles/spec-hub.css`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
- Tests
    - `src/features/spec/components/SpecHub.test.tsx`
    - `src/features/spec/hooks/useSpecHub.test.tsx`
    - `src/features/spec/runtime.test.ts`（验证编排回归）

---

## Proposal Addendum (2026-02-25): Verify Auto-Completion Realtime Overlay + Draggable Feedback

### Why (Incremental)

当前 `验证 + 自动补全` 已有“行内文案”反馈，但对用户来说可观测性仍弱于 Apply/提案流程：  
看不到统一的阶段状态、实时日志、执行摘要，且反馈容器固定在右下角，不支持拖拽，移动端和窄面板下会遮挡关键内容。

为保持操作体验一致性，`验证补全` 应复用“AI 接管/执行反馈弹窗”而不是使用独立轻提示，并补齐拖拽能力。

### Incremental Changes

1. `验证` 动作在“勾选自动补全且缺失 verification”时，复用现有提案/执行使用的 AI 接管反馈弹窗。
2. 反馈弹窗展示统一运行信息：
    - `status / phase / engine`
    - 实时输出流（delta）
    - 日志（logs）
    - 完成摘要（summary）与错误（error）
3. 流程阶段最少包含：
    - `completion-dispatch`
    - `completion-execution`
    - `completion-finalize`
    - （成功后）`verify-dispatch` / `verify-finalize`
4. 补全过程失败时，弹窗 SHALL 显式显示“补全失败，未进入 strict validate”。
5. 反馈弹窗改为可拖拽：
    - 默认仍在右下角（保持当前初始体验）
    - 用户可通过标题区拖拽位置，避免遮挡
    - 关闭后下一次运行恢复默认位置（避免跨会话错位）

### Acceptance Criteria (Incremental)

1. 勾选自动补全并触发验证时，系统 SHALL 显示与提案/执行同源的反馈弹窗，而非仅行内文案。
2. 反馈弹窗 SHALL 提供实时阶段与日志更新，用户可明确区分“补全中”与“验证中”。
3. 补全失败时，系统 SHALL 在弹窗内展示错误并明确本次未执行 strict validate。
4. 反馈弹窗 SHALL 支持拖拽移动，且拖拽后不影响当前任务运行。
5. 未勾选自动补全或 verification 已存在时，系统 SHALL 保持现有验证链路，不强制弹出补全反馈弹窗。

### Impact (Incremental)

- Frontend
    - `src/features/spec/components/SpecHub.tsx`
    - `src/styles/spec-hub.css`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
- Tests
    - `src/features/spec/components/SpecHub.test.tsx`
    - `src/features/spec/hooks/useSpecHub.test.tsx`
    - `src/features/spec/runtime.test.ts`

---

## Proposal Addendum (2026-02-25): Continue AI Enhancement (Read-Only) + Execute Handoff

### Why (Incremental)

当前 `继续` 仅返回 OpenSpec 指引文本，用户在进入 `执行` 前仍需要人工消化信息并二次整理上下文。  
我们希望保留 `继续` 的“先看指引”定位，同时增加一个可选的 AI 增强层，产出结构化执行计划，并在后续 `执行` 时自动复用，减少上下文丢失与重复沟通。

### Incremental Changes

1. 在 `继续` 动作旁新增复选框（文案示例：`AI 增强`），默认不勾选。
2. 未勾选时，`继续` 行为保持现状：仅执行 `openspec instructions specs --change <id>` 并展示原始输出。
3. 勾选后，`继续` 采用“命令 + AI 增强”双阶段：
    - 阶段 A：执行 OpenSpec 指令，获取基础指引；
    - 阶段 B：调用所选共享执行引擎进行只读分析，生成结构化执行简报（Execution Brief）。
4. `继续 + AI 增强` SHALL 严格只读，不得修改代码或文档：
    - AI 调用使用 `read-only` 访问模式；
    - Prompt 显式禁止写文件/改任务；
    - 该链路不接入任务回写或任何落盘逻辑。
5. 系统 SHALL 缓存“最近一次 Continue AI 增强简报”（按 change 维度）。
6. `执行` 动作 SHALL 默认复用该简报作为额外上下文输入（可显式关闭），形成“继续预处理 -> 执行落地”的连续链路。
7. 当无可用简报或用户关闭复用时，`执行` SHALL 回退为当前行为，不受影响。

### Acceptance Criteria (Incremental)

1. 系统 SHALL 在 `继续` 动作旁提供 `AI 增强` 复选框，且默认值为未勾选。
2. 未勾选时，`继续` SHALL 与当前版本完全一致（命令、输出、状态表现不变）。
3. 勾选时，`继续` SHALL 在 OpenSpec 指令成功后生成结构化 AI 执行简报，至少包含：
    - 推荐下一步动作；
    - 建议修改范围（文件/产物）；
    - 风险与验证建议；
    - 建议执行顺序。
4. `继续 + AI 增强` 全流程 SHALL NOT 产生任何代码或文档变更，也 SHALL NOT 自动勾选任务。
5. 在存在最新简报时，`执行` SHALL 默认携带该简报上下文；用户关闭复用后 SHALL 按原流程执行。
6. 系统 SHALL 对“是否复用 Continue AI 简报”给出可见状态提示，避免黑盒行为。

### Impact (Incremental)

- Frontend
    - `src/features/spec/components/SpecHub.tsx`
    - `src/features/spec/hooks/useSpecHub.ts`
    - `src/styles/spec-hub.css`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
- Tests
    - `src/features/spec/components/SpecHub.test.tsx`
    - `src/features/spec/hooks/useSpecHub.test.tsx`
    - `src/features/spec/runtime.test.ts`

---

## Proposal Addendum (2026-02-25): Post-Proposal Progressive Completion (Unblock Continue/Apply)

### Why (Incremental)

当前部分新建 change 在“仅完成 proposal、尚缺 design/specs delta/tasks”阶段会进入阻塞态，导致 `继续/执行` 也被一起禁用。  
这会把用户卡在“缺产物但无法触发补全动作”的死锁状态，与 OpenSpec 的渐进式产物生成链路不一致。

我们希望把“用于补全产物的动作”和“依赖完整产物的动作”解耦：  
允许用户在客户端内沿 `继续 -> 执行 -> 验证 -> 归档` 逐步补全，而不是被前置门禁提前拦截。

### Incremental Changes

1. 新建提案后若仅有 proposal，系统 SHALL 允许进入渐进补全链路。
2. `继续` SHALL 不因缺失 `design/specs delta/tasks` 被禁用；它的职责就是补齐上游产物（尤其 specs/design 指引）。
3. `执行` SHALL 在满足最小前置（如可执行的 specs 指引已具备）后可触发，用于生成/补全 `tasks` 与实现落地。
4. `验证` 与 `归档` 保持严格门禁，不放宽核心产物完整性约束。
5. 当产物缺失时，UI SHALL 优先展示“推荐下一步动作”（例如“先继续，再执行”），而不是仅展示阻塞告警。

### Acceptance Criteria (Incremental)

1. 在“仅 proposal、缺 design/specs delta/tasks”场景下，`继续` 按钮 SHALL 可点击。
2. 同场景下，系统 SHALL 提示推荐链路为 `继续 -> 执行`，并在产物补齐后自然进入 `验证`。
3. `执行` SHALL 不再被“缺 tasks.md”本身阻塞（因为其职责包含补全 tasks）。
4. `验证` SHALL 仍要求核心产物达到验证前置条件；未满足时继续阻塞。
5. `归档` SHALL 继续要求 strict verify 与必需任务完成，不因本增量放宽。

### Impact (Incremental)

- Frontend
    - `src/features/spec/components/SpecHub.tsx`
    - `src/features/spec/hooks/useSpecHub.ts`
    - `src/styles/spec-hub.css`
- Runtime
    - `src/lib/spec-core/runtime.ts`
- Tests
    - `src/features/spec/components/SpecHub.test.tsx`
    - `src/features/spec/hooks/useSpecHub.test.tsx`
    - `src/features/spec/runtime.test.ts`
