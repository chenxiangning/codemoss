## 1. Apply Execution Orchestration

- [x] 1.1 [P0][依赖:无] 扩展 `apply` 动作运行契约（输入: 现有 `runSpecAction` 输出；输出: apply 阶段化结果结构；验证:
  类型与单测通过）
- [x] 1.2 [P0][依赖:1.1] 实现 apply 双轨流程（Guidance/Execute）（输入: change + agent；输出: 可执行编排路径；验证: Execute
  分支可触发）
- [x] 1.3 [P0][依赖:1.2] 实现 apply 失败恢复策略（输入: phase error；输出: 结构化失败摘要与下一步建议；验证: 失败场景 UI
  可见）
- [x] 1.4 [P0][依赖:1.2] 实现 apply 引擎路由（Claude Code/Codex/OpenCode）（输入: 用户选择 + 可用引擎集；输出:
  按所选引擎执行或给出不可用提示；验证: 三引擎路由用例通过）

## 2. Explicit Feedback in UI

- [x] 2.1 [P0][依赖:1.2] 新增 Apply 阶段反馈卡（输入: phase state；输出:
  preflight/instructions/execution/task-writeback/finalize 可见；验证: 运行中状态即时出现）
- [x] 2.2 [P0][依赖:2.1] 新增结果提示文案（成功/失败/无变更）（输入: apply result；输出: 用户可理解提示；验证: 三类场景均有提示）
- [x] 2.3 [P1][依赖:2.2] 增加执行结果摘要展示（输入: changed files/tests/checks；输出: 结构化摘要块；验证: 成功后摘要可见）
- [x] 2.4 [P0][依赖:1.4] 新增 Apply 引擎选择器（输入: 可用引擎清单；输出: Claude Code/Codex/OpenCode
  可选且执行中锁定；验证: UI 交互与状态同步正确）

## 3. Task Auto-Writeback

- [x] 3.1 [P0][依赖:1.2] 定义 completed tasks 映射协议（输入: execution output；输出: 可映射 task indices；验证: 解析单测通过）
- [x] 3.2 [P0][依赖:3.1] 实现自动勾选与状态刷新（输入: completedTaskIndices；输出: `tasks.md` 回写 + gate/action
  同步；验证: 勾选后进度变化正确）
- [x] 3.3 [P1][依赖:3.2] 实现回写失败回滚（输入: IO 失败；输出: UI/内存恢复 + 错误提示；验证: 失败不污染状态）

## 4. Tests and Regression

- [x] 4.1 [P0][依赖:1~3] 补 `useSpecHub.test.tsx` 覆盖 apply execute 成功/失败/无变更（验证: 断言通过）
- [x] 4.2 [P0][依赖:2] 补 `SpecHub.test.tsx` 覆盖 apply 反馈卡与提示文案（验证: running/success/fail/no-change 可见）
- [x] 4.3 [P0][依赖:3] 补 runtime/task 回写相关测试（验证: completed task 映射与回滚通过）
- [x] 4.4 [P0][依赖:1.4,2.4] 补引擎选择与路由测试（验证: Claude/Codex/OpenCode 选择后命令按预期路由）
- [x] 4.5 [P1][依赖:4.1~4.4] 运行回归：`vitest + typecheck`（验证: 退出码 0）

## 5. Manual UX Validation

- [x] 5.1 [P1][依赖:4.5] 手工验证“剩余编码任务 -> 点击 Apply -> 出现执行反馈 -> 产生代码变更/无变更提示”（验证: 用户可感知）
- [x] 5.2 [P1][依赖:5.1] 手工验证自动任务回写链路（验证: 任务勾选、门禁状态、提示一致）
- [x] 5.3 [P1][依赖:5.1] 手工验证三引擎选择链路（验证: 选择 Claude/Codex/OpenCode 后执行反馈中引擎标识正确）

## 6. Console IA Reorder and Project-First Default

- [x] 6.1 [P0][依赖:无] 调整控制区 tab 顺序为 `项目` 在前、`动作` 在后（验证: 初始渲染顺序符合设计）
- [x] 6.2 [P0][依赖:6.1] 将默认 active tab 切换为 `项目`（验证: 首次进入执行台默认显示项目区）
- [x] 6.3 [P1][依赖:6.1] 补充 tab 顺序与默认态回归测试（验证: SpecHub 相关测试断言通过）

## 7. Project Tab Layout Refactor

- [x] 7.1 [P0][依赖:6.2] 重构 `SPEC 位置配置` 卡片布局（输入框、状态文案、保存/恢复按钮）（验证: 路径操作不回归）
- [x] 7.2 [P0][依赖:6.2] 重构 `项目信息` 卡片布局（下拉、摘要、命令、主按钮层级）（验证: 自动填充链路可用）
- [x] 7.3 [P1][依赖:7.1,7.2] 统一 icon/按钮/文案间距规范并补视觉快照回归（验证: 窄面板可读性稳定）

## 8. Actions Area Restructure and Proposal Workflows

- [x] 8.1 [P0][依赖:6.2] 新增“动作编排”主卡并承载全局执行引擎选择器（验证: 页面只保留一处引擎选择）
- [x] 8.2 [P0][依赖:8.1] 新增“新增提案”入口与弹窗流程（输入提案内容 -> AI 处理）（验证: 可触发处理流程并反馈）
- [x] 8.3 [P0][依赖:8.1] 新增“追加提案”入口与弹窗流程（可绑定目标 change + 输入补充内容）（验证: 目标绑定正确传递）
- [x] 8.4 [P0][依赖:8.2,8.3] 复用 Apply 级反馈浮层到提案处理（状态/阶段/输出/日志）（验证: 运行过程实时可见）
- [x] 8.5 [P1][依赖:8.4] 处理完成后刷新运行态并可定位相关 change（验证: 列表与详情状态同步）

## 9. Shared Engine Routing and Regression

- [x] 9.1 [P0][依赖:8.1] 将 Apply / AI 接管 / 提案动作统一接入共享引擎状态（验证: 三类动作读取同一 engine）
- [x] 9.2 [P0][依赖:9.1] 增补 runtime + adapter 单测，覆盖 create/append 模式和错误恢复（验证: 新增断言通过）
- [x] 9.3 [P1][依赖:9.2] 端到端手工回归：项目默认 tab、动作区重构、提案新增/追加、反馈复用、引擎共享（验证: 关键路径可执行）

## 10. Proposal Composer and Image Upload

- [x] 10.1 [P0][依赖:8.2,8.3] 将新增/追加提案弹窗输入区升级为大文本 composer（验证: 长文本编辑体验稳定）
- [x] 10.2 [P0][依赖:10.1] 支持图片上传能力（至少显式上传入口，含预览与移除）（验证: 图文输入可提交）
- [x] 10.3 [P0][依赖:10.2] 增加图片类型/大小校验与错误提示（验证: 非法文件被阻止且提示明确）
- [x] 10.4 [P1][依赖:10.1] 支持粘贴/拖拽图片输入（如宿主能力允许）（验证: 粘贴或拖拽路径可用）

## 11. Engine Selector Icon and Compact Action Row

- [x] 11.1 [P0][依赖:8.1] 执行引擎下拉在触发器与选项中显示引擎 icon + label（验证: 选中态与下拉态一致）
- [x] 11.2 [P0][依赖:11.1] 将“新增提案/追加提案”两个入口移动到引擎下拉右侧并同排展示（验证: 三控件同一行）
- [x] 11.3 [P0][依赖:11.2] 将提案入口改为 icon-only 按钮并保留 tooltip/aria-label（验证: 可访问性与可发现性通过）
- [x] 11.4 [P1][依赖:11.3] 适配窄宽度折行/压缩策略，确保布局不溢出（验证: 典型窄面板视觉回归通过）

## 12. Regression for New UI Details

- [x] 12.1 [P0][依赖:10.2,11.3] 增补 `SpecHub.test.tsx`：覆盖图文提案输入、icon-only 按钮触发、引擎 icon 展示（验证: 断言通过）
- [x] 12.2 [P0][依赖:10.3] 增补 runtime/adapter 测试：附件校验失败与恢复提示（验证: 错误路径断言通过）
- [x] 12.3 [P1][依赖:12.1,12.2] 手工回归：图文新增提案、图文追加提案、同排布局与交互（验证: 关键链路稳定）

## 13. Verify Optional Auto-Completion

- [x] 13.1 [P0][依赖:无] 在 `验证` 动作旁新增“自动补全”复选框并默认关闭（验证: 默认态不勾选，布局与可访问性通过）
- [x] 13.2 [P0][依赖:13.1] 未勾选时保持现有验证链路不变（验证: 仍执行 `openspec validate <change-id> --strict`）
- [x] 13.3 [P0][依赖:13.1] 勾选时实现“缺 verification 先补全后 strict validate”编排（验证: 缺失场景先补全再验证）
- [x] 13.4 [P0][依赖:13.3] 补全失败时中止验证并给出可操作错误提示（验证: 失败场景不触发 validate）
- [x] 13.5 [P1][依赖:13.1,13.3] 执行期间锁定复选框与验证入口，防止并发切换（验证: 运行中控件禁用）

## 14. Verify Auto-Completion Regression

- [x] 14.1 [P0][依赖:13.2,13.3,13.4] 增补 `SpecHub.test.tsx`：覆盖默认关闭、勾选分支、缺失/存在 verification 分支（验证:
  断言通过）
- [x] 14.2 [P0][依赖:13.3,13.4] 增补 `useSpecHub.test.tsx`：覆盖补全成功后验证、补全失败中止（验证: 状态机断言通过）
- [x] 14.3 [P0][依赖:13.3,13.4] 增补 `runtime.test.ts`：覆盖 verify 编排与错误传播语义（验证: strict validate 调用条件正确）
- [x] 14.4 [P1][依赖:14.1,14.2,14.3] 手工回归：不勾选直通验证、勾选触发补全、失败中止（验证: 关键链路稳定）

## 15. Verify Auto-Completion Overlay Reuse and Draggable UX

- [x] 15.1 [P0][依赖:13.3] 将 `验证补全` 接入与 Apply/提案同源的反馈弹窗（输入: verify 补全过程状态；输出:
  统一 status/phase/engine/output/log 展示；验证: 补全运行态可见）
- [x] 15.2 [P0][依赖:15.1] 失败时在弹窗内显式标注 `validate skipped` 并中止验证链路（输入: completion failure；输出:
  明确失败摘要与中止语义；验证: 不触发 strict validate）
- [x] 15.3 [P0][依赖:15.1] 为反馈弹窗增加拖拽能力（默认右下，支持标题区拖拽，边界限制）（验证:
  拖拽后位置更新且不遮挡关键操作区）
- [x] 15.4 [P1][依赖:15.3] 关闭弹窗后位置回归默认锚点（验证: 下一次运行从默认位置打开）
- [x] 15.5 [P0][依赖:15.1,15.2] 增补 `SpecHub.test.tsx`：覆盖 verify 补全弹窗复用、失败中止与 skipped 文案（验证:
  断言通过）
- [x] 15.6 [P0][依赖:15.1,15.3] 增补 `useSpecHub.test.tsx` / `runtime.test.ts`：覆盖阶段事件与 skipped 语义（验证:
  状态机断言通过）
- [x] 15.7 [P1][依赖:15.5,15.6] 手工回归：窄屏/滚动场景拖拽可用，验证补全阶段反馈连贯（验证: 关键链路稳定）

## 16. Continue AI Enhancement (Read-Only) + Execute Handoff

- [x] 16.1 [P0][依赖:无] 在 `继续` 动作旁新增 `AI 增强` 复选框（默认关闭），并补充“只读分析不改文件”提示文案（验证:
  默认态与未勾选行为不变）
- [x] 16.2 [P0][依赖:16.1] 实现 `继续` 双阶段编排：OpenSpec continue 指令 + 可选 AI read-only 简报生成（验证:
  勾选时可产出简报，未勾选不进入 AI 阶段）
- [x] 16.3 [P0][依赖:16.2] 落实只读约束（accessMode=read-only、Prompt 禁止写入、无任务回写路径）（验证:
  运行链路无文件变更/无任务自动勾选）
- [x] 16.4 [P0][依赖:16.2] 定义并实现 Continue Brief 结构化结果解析与容错
  fallback（summary/next/scope/risks/verification/sequence）（验证:
  异常输出可降级，UI 不崩溃）
- [x] 16.5 [P0][依赖:16.4] 新增按 `changeId + specRoot` 维度保存/读取最近简报状态（验证:
  切换 change 后简报隔离正确）
- [x] 16.6 [P0][依赖:16.5] 在 `执行` 入口增加“复用 Continue AI 简报”开关（有简报时默认开启，可关闭）（验证:
  开关状态可见且可切换）
- [x] 16.7 [P0][依赖:16.6] 扩展 `buildApplyExecutionPrompt` 注入简报上下文片段（仅开关开启且简报可用时注入）（验证:
  执行日志可识别是否使用简报）
- [x] 16.8 [P1][依赖:16.5] 增加简报新鲜度提示（最近生成时间/可能过期提示），但不阻断执行（验证:
  仅提示不改变执行可用性）
- [x] 16.9 [P0][依赖:16.1~16.7] 增补 `SpecHub.test.tsx`：覆盖 continue 勾选分支、简报展示、执行复用开关交互（验证:
  断言通过）
- [x] 16.10 [P0][依赖:16.2~16.7] 增补 `useSpecHub.test.tsx`：覆盖 continue 双阶段状态机与 apply prompt 注入分支（验证:
  状态/参数断言通过）
- [x] 16.11 [P0][依赖:16.3,16.4] 增补 `runtime.test.ts`：覆盖只读约束语义与结构化简报解析失败降级（验证:
  失败分支与回退路径通过）
- [x] 16.12 [P1][依赖:16.9~16.11] 手工回归：未勾选继续、勾选继续生成简报、执行复用/关闭复用、简报过期提示（验证:
  关键链路稳定）

## 17. Post-Proposal Progressive Completion (Unblock Continue/Apply)

- [x] 17.1 [P0][依赖:无] 定义 proposal-only 阶段动作门禁矩阵（continue/apply/verify/archive）并对齐 runtime 文案键（验证:
  矩阵规则可映射到代码与 UI）
- [x] 17.2 [P0][依赖:17.1] 调整 `buildSpecActions`：`继续` 不再被缺 design/specs/tasks 阻塞（验证:
  proposal-only 场景 continue 可点击）
- [x] 17.3 [P0][依赖:17.1] 调整 `buildSpecActions`：`执行` 不再被“缺 tasks.md”阻塞，缺 specs delta 时输出明确 next-step
  blocker（验证:
  缺 tasks 可执行、缺 specs 时有可操作提示）
- [x] 17.4 [P0][依赖:17.2,17.3] 在动作区增加“推荐下一步”提示渲染（先继续/再执行），避免仅展示阻塞告警（验证:
  缺产物场景提示与可用性一致）
- [x] 17.5 [P0][依赖:17.2,17.3] 增补 `runtime.test.ts`：覆盖 proposal-only、缺 specs、缺 tasks 三类门禁矩阵（验证:
  continue/apply/verify/archive 可用性断言通过）
- [x] 17.6 [P0][依赖:17.4] 增补 `SpecHub.test.tsx`：覆盖 proposal-only 时 continue 可点、缺 specs
  时执行提示与按钮状态（验证:
  断言通过）
- [x] 17.7 [P1][依赖:17.5,17.6] 手工回归：新建提案后仅 proposal 场景可沿 `继续 -> 执行 -> 验证` 渐进补全（验证:
  不再出现“缺产物但无法补全”的死锁）
