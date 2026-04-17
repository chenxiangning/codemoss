> 执行批次拆解见：`apply-plan-p0.md`（P0）与 `apply-plan-p1.md`（P1）  
> 全任务确认矩阵见：`task-confirmation-matrix.md`

## 1. Runtime Model and State Machine

- [x] 1.1 [P0][依赖:无] 定义 `SpecWorkspace/SpecChange/SpecArtifact/SpecAction/SpecBlocker` 统一类型与状态枚举（输入:
  proposal + specs; 输出: 类型定义与注释; 验证: TypeScript 类型检查通过）
- [x] 1.2 [P0][依赖:1.1] 实现 change 扫描与 artifact 完整性计算（输入: workspace `openspec/changes`; 输出: 统一 runtime
  state 数据; 验证: 样例仓库状态快照测试通过）
- [x] 1.3 [P0][依赖:1.2] 实现状态推导器（draft/ready/implementing/verified/archived/blocked）（输入: artifact 状态 +
  validate 结果; 输出: 确定性状态值; 验证: 状态转换用例通过）
- [x] 1.4 [P0][依赖:1.3] 增加 workspace 级隔离缓存（输入: workspace 切换事件; 输出: 无跨 workspace 状态泄漏; 验证: 双
  workspace 切换回归通过）

## 2. OpenSpec Adapter

- [x] 2.1 [P0][依赖:1.1] 封装 OpenSpec 命令执行器（continue/apply/verify/archive/validate）（输入: action + change; 输出:
  结构化执行结果; 验证: 成功/失败路径单测通过）
- [x] 2.2 [P0][依赖:2.1] 实现 preflight blocker 检测（输入: action + artifacts + doctor state; 输出: blocker 列表; 验证:
  缺失 tasks 时 apply 被阻断）
- [x] 2.3 [P0][依赖:2.1] 实现 strict validate 结构化解析（输入: validate 输出; 输出: diagnostics 列表; 验证: 失败项可定位
  change 与原因）
- [x] 2.4 [P1][依赖:2.1] 增加错误上下文增强（命令/路径/provider/exitCode）（输入: 执行异常; 输出: enriched error payload;
  验证: UI 无需解析原始日志即可渲染）

## 3. Spec Hub Workbench UI

- [x] 3.1 [P0][依赖:1.2] 搭建 Spec Hub 页面壳与主状态容器（输入: runtime state; 输出: 页面路由入口 + 页面级 store; 验证:
  页面可稳定挂载并完成首次数据加载）
- [x] 3.2 [P0][依赖:3.1] 落地三栏布局骨架（Changes/Artifacts/执行台）（输入: 页面容器; 输出: 三栏网格与最小宽度约束; 验证:
  初次加载三栏完整渲染）
- [x] 3.3 [P0][依赖:3.2] 实现变更列表与状态筛选器（输入: change list + status filters; 输出: 左栏筛选与列表渲染; 验证:
  全部/活跃/阻塞/归档筛选结果正确）
- [x] 3.4 [P0][依赖:3.3] 实现 change 选择联动（输入: selectedChangeId; 输出: 中栏与右栏上下文同步; 验证: 切换 change
  后详情无错位）
- [x] 3.5 [P0][依赖:3.4] 实现产物 Tabs 与文档渲染（输入: proposal/design/spec/tasks/verification; 输出: Tabs 内容区与空态;
  验证: 缺失 artifact 时显示明确空态）
- [x] 3.6 [P0][依赖:3.4] 实现执行台 Tabs 容器（动作/门禁/时间线/环境诊断）（输入: selected change context; 输出: 右栏 Tab
  导航与面板切换; 验证: Tab 切换不丢失上下文）
- [x] 3.7 [P0][依赖:2.1,3.6] 实现执行台动作 Tab（输入: action definitions + command preview; 输出:
  Continue/Apply/Verify/Archive 按钮区与执行结果区; 验证: 成功/失败状态可见）
- [x] 3.8 [P0][依赖:2.2,3.6] 实现执行台门禁 Tab（输入: blockers + action availability; 输出: 门禁原因和禁用态; 验证:
  blocker 与动作禁用状态一致）
- [x] 3.9 [P0][依赖:1.4,3.6] 实现执行台时间线 Tab（输入: action/validate events; 输出: 时间线列表与排序; 验证:
  新执行事件可实时追加）
- [x] 3.10 [P0][依赖:4.1,3.6] 实现执行台环境诊断 Tab（输入: doctor health report; 输出: 依赖状态、版本、诊断提示; 验证:
  缺失依赖时提示可见）
- [x] 3.11 [P0][依赖:2.3,3.7,3.6] 实现执行台验证失败结构化反馈（输入: diagnostics; 输出: 失败项、原因、修复提示、定位入口;
  验证: 失败项可跳转到目标上下文）
- [x] 3.12 [P1][依赖:3.2,3.6] 实现状态/风险/action icon+label 语义映射（输入: 状态字典; 输出: 一致化视觉编码 + a11y 文案;
  验证: 语义抽检清单通过）

## 4. Environment Doctor and Mode Management

- [x] 4.1 [P0][依赖:无] 实现 OpenSpec 依赖探测与版本采集（输入: PATH 环境; 输出: health report; 验证: 缺失/存在两类场景输出正确）
- [x] 4.2 [P0][依赖:4.1] 实现 Managed/BYO workspace 级模式持久化（输入: 用户模式选择; 输出: 重启后模式保持; 验证:
  持久化回读测试通过）
- [x] 4.3 [P0][依赖:4.1,3.8] 接入 unhealthy -> read-only 降级策略（输入: doctor state; 输出: 执行动作禁用、浏览保持可用;
  验证: 环境异常时不可执行）
- [x] 4.4 [P1][依赖:4.3] 实现修复建议与重试入口（输入: 诊断失败信息; 输出: 可执行修复步骤和 retry; 验证: 修复后重试可恢复
  action 可用）

## 5. spec-kit Minimal Hook

- [x] 5.1 [P1][依赖:1.1] 实现 spec-kit provider detect 与 support-level 标记（输入: workspace markers; 输出:
  `provider=spec-kit, level=minimal`; 验证: 识别准确率测试通过）
- [x] 5.2 [P1][依赖:5.1,3.1] 接入 spec-kit read-only artifact 映射（输入: spec-kit 变更文件; 输出: 可浏览详情; 验证:
  缺字段不崩溃并显示 metadata）
- [x] 5.3 [P1][依赖:5.1,3.7] 接入 unsupported action 外部跳转入口（输入: minimal 模式动作点击; 输出: command/docs
  passthrough; 验证: 明确边界提示可见）

## 6. Quality Gates and Delivery

- [x] 6.1 [P0][依赖:2.x,3.x,4.x] 补充单测矩阵（runtime/adapter/doctor/ui）并覆盖关键失败路径（输入: 新模块测试文件; 输出:
  回归测试集; 验证: `npm run test` 通过）
- [x] 6.2 [P0][依赖:6.1] 执行 `npm run typecheck` 与 `npm run lint`（输入: 全仓代码; 输出: 零错误; 验证: 命令退出码 0）
- [x] 6.3 [P0][依赖:6.2] 执行手工验收清单（OpenSpec 主路径 + spec-kit minimal + 降级策略）（输入: QA checklist; 输出: 验收记录;
  验证: 验收项全通过）
- [x] 6.4 [P1][依赖:6.3] 在变更目录补充 `verification.md` 与演示说明（输入: 测试与验收结果; 输出: 可追溯验证文档; 验证:
  团队评审可复核）

## 7. OpenSpec 初始化引导与项目信息治理（追加提案）

- [x] 7.1 [P1][依赖:1.2] 在 runtime 层新增“无 OpenSpec 工作区”可引导状态（输入: provider=unknown + workspace metadata;
  输出: onboarding state + entry actions; 验证: unknown 场景可生成引导态）
- [x] 7.2 [P1][依赖:2.1,4.1] 新增 OpenSpec 初始化动作封装（输入: workspace path + init mode; 输出: `openspec init`
  结构化执行结果; 验证: 成功/失败路径均可在执行台展示）
- [x] 7.3 [P1][依赖:3.6,7.1] 在执行台新增“初始化 OpenSpec”入口（输入: unknown workspace context; 输出: 可见的引导入口与禁用条件;
  验证: 无 OpenSpec 时可触发初始化流程）
- [x] 7.4 [P1][依赖:7.3] 落地老项目/新项目双路径引导（输入: 用户选择 old/new project; 输出: 分支化引导步骤与文案; 验证:
  两条路径均可完成初始化）
- [x] 7.5 [P1][依赖:7.4] 定义并实现项目信息采集结构（输入: 领域、架构、约束、命令、负责人等字段; 输出: 结构化项目背景文档;
  验证: 必填字段校验与落盘成功）
- [x] 7.6 [P2][依赖:7.5] 实现项目信息后续更新与历史追踪（输入: 更新请求; 输出: 版本化更新记录与变更摘要; 验证:
  至少一次更新后可回看历史）
- [x] 7.7 [P1][依赖:7.2,7.5] 初始化完成后自动刷新并进入可执行态（输入: init success; 输出: provider 从 unknown 转为
  openspec，Changes 列表可见; 验证: 无需手工重进页面）
- [x] 7.8 [P1][依赖:7.2~7.7] 增补自动化与手工验收（输入: 新增流程测试清单; 输出: onboarding + project-info 测试结果;
  验证: 关键流程覆盖通过）

## 8. 外置 Spec 根目录配置能力（追加提案）

- [x] 8.1 [P1][依赖:1.2] 定义 Spec 根目录解析模型（输入: workspace path + optional custom path; 输出:
  `resolvedSpecRoot` + source(default/custom); 验证: 路径优先级与回退逻辑单测通过）
- [x] 8.2 [P1][依赖:8.1,4.2] 实现 workspace 级 Spec 根目录持久化（输入: 用户配置路径; 输出: 重启后配置可回读; 验证:
  持久化测试通过）
- [x] 8.3 [P1][依赖:8.1] 在 runtime provider detect 中接入可配置根目录（输入: resolvedSpecRoot; 输出:
  provider/supportLevel 基于目标路径计算; 验证: 外置目录可识别 openspec）
- [x] 8.4 [P1][依赖:8.3,3.1] 接入 changes/artifacts 读取改造（输入: resolvedSpecRoot; 输出: 列表与详情正确加载; 验证:
  外置路径下 proposal/design/spec/tasks 可浏览）
- [x] 8.5 [P1][依赖:8.3,2.2] 动作执行 preflight 增加根目录回显与结构校验（输入: action request; 输出:
  当前 spec root + blocker; 验证: 无效目录时动作阻断并提示修复）
- [x] 8.6 [P1][依赖:3.6,8.2] 在执行台新增“Spec 位置配置”区（输入: 当前路径状态; 输出: 查看/修改/恢复默认入口; 验证:
  配置后无需重开页面即可生效）
- [x] 8.7 [P1][依赖:8.6] 增加路径校验与错误提示（不存在/无权限/非目录/结构缺失）（输入: 用户路径; 输出:
  结构化错误信息 + 建议操作; 验证: 错误场景文案与状态一致）
- [x] 8.8 [P1][依赖:8.1~8.7] 增补自动化与手工验收（输入: 默认路径 + 外置路径 + 无效路径案例; 输出:
  回归与验收记录; 验证: 关键流程覆盖通过）

## 9. Tasks 复选框交互写回与归档门禁对齐（追加提案）

- [x] 9.1 [P1][依赖:3.5] 在 Tasks artifact 渲染层输出可编辑任务节点模型（输入: tasks.md markdown; 输出:
  checkbox 节点定位信息（行号/偏移/状态）; 验证: 不同层级任务可稳定定位）
- [x] 9.2 [P1][依赖:9.1] 实现任务复选框点击写回 `tasks.md`（输入: task toggle action; 输出:
  markdown 状态落盘; 验证: 单条与连续多条切换都可正确写回）
- [x] 9.3 [P1][依赖:9.2] 增加写回失败回滚与错误提示（输入: 写文件失败/权限失败; 输出:
  UI 状态回滚 + 结构化错误提示; 验证: 失败后不会残留假成功勾选）
- [x] 9.4 [P1][依赖:9.2] 写回成功后联动刷新任务进度与动作门禁（输入: 写回成功事件; 输出:
  `taskProgress` 与 actions availability 同步更新; 验证: 无需重开页面即可看到门禁变化）
- [x] 9.5 [P1][依赖:9.4] 明确验证与任务状态解耦规则（输入: verify success; 输出:
  任务复选框保持原状，不自动修改; 验证: verify 后任务状态不发生隐式变化）
- [x] 9.6 [P1][依赖:9.4,9.5] 归档门禁增加“验证通过 + 必需任务完成”联合判定（输入: archive preflight; 输出:
  缺失项 blocker 明细; 验证: 任一条件不满足时 archive 禁用并给出明确原因）
- [x] 9.7 [P1][依赖:9.6] 在时间线记录任务状态变更事件（输入: task toggle success; 输出:
  task update timeline event; 验证: 可追踪谁在何时修改了哪些任务）
- [x] 9.8 [P1][依赖:9.1~9.7] 增补自动化与手工验收（输入: 成功/失败/并发切换/归档门禁场景; 输出:
  回归结果与验收记录; 验证: 关键流程覆盖通过）
- [x] 9.9 [P1][依赖:9.1~9.4] 任务区交互依据显式化与渲染稳定化（输入: 实际 `tasks.md` 复杂层级样本 + 用户反馈截图; 输出:
  “仅任务行可编辑”规则提示、执行中/写回中只读提示、行模型渲染替代 markdown checkbox 劫持; 验证:
  不再出现“同屏有的可点有的不可点但无说明”的体验问题）

## 10. 会话级 Spec 关联与上下文注入（追加提案）

- [x] 10.1 [P1][依赖:8.1,8.2] 定义会话启动期 spec 关联模型（输入: workspaceId + resolvedSpecRoot; 输出:
  sessionSpecLink context; 验证: 模型在新会话初始化可读）
- [x] 10.2 [P1][依赖:10.1] 在新会话创建流程注入 spec 路径白名单（输入: sessionSpecLink; 输出:
  会话内规范扫描目标路径集合; 验证: 不再仅依赖项目名推导路径）
- [x] 10.3 [P1][依赖:10.2] 实现会话级 spec 可见性探测与结构化结果（输入: 目标 spec root; 输出:
  visible/invalid/permissionDenied 等状态; 验证: 三类场景结果可复现）
- [x] 10.4 [P1][依赖:10.3,3.1] 在会话首屏回显“已关联 spec 路径/失败原因”（输入: 探测结果; 输出:
  首屏状态提示; 验证: 用户可直接确认关联是否生效）
- [x] 10.5 [P1][依赖:10.3,8.6] 提供失败修复动作（重新绑定 Spec Hub 路径/恢复默认路径）（输入:
  invalid link state; 输出: 一键修复入口; 验证: 修复后同会话可重新探测成功）
- [x] 10.6 [P1][依赖:10.2~10.5] 打通“你能看到我的 spec 吗”问答校验链路（输入:
  会话探测状态 + 规范读取协议; 输出: 与真实状态一致的回答; 验证: 预设回归用例通过）
- [x] 10.7 [P1][依赖:10.1~10.6] 增补自动化与手工验收（输入: 默认路径/外置路径/失效路径会话样例; 输出:
  回归记录与验收结论; 验证: 新会话场景覆盖通过）

## 11. 归档失败 AI 接管修复（追加提案）

- [x] 11.1 [P1][依赖:3.7,9.6] 在执行台动作区新增“AI 接管归档阻塞”入口（输入: selected change + archive blockers; 输出:
  接管入口与禁用态; 验证: blocker 场景可见并可触发）
- [x] 11.2 [P1][依赖:11.1] 构建归档接管 prompt 上下文（输入: changeId/specRoot/blockers/latest archive output; 输出:
  结构化接管指令; 验证: prompt 包含关键诊断信息）
- [x] 11.3 [P1][依赖:11.2] 接入 engine sync 调用执行 AI 接管（输入: agent selection + full-access mode; 输出:
  接管结果文本 + 错误回显; 验证: codex/claude/opencode 任一可用引擎可执行）
- [x] 11.4 [P1][依赖:11.3] 接管后自动刷新 runtime 与动作门禁（输入: AI 接管完成事件; 输出: 状态刷新与可归档性复核; 验证:
  无需重开页面即可看到最新 blocker/状态）
- [x] 11.5 [P1][依赖:11.1~11.4] 增补自动化回归（输入: archive blocker + archive semantic fail 场景; 输出:
  runtime/文案映射测试结果; 验证: typecheck + lint + runtime test 通过）

## 12. AI 接管执行可视化（追加提案）

- [x] 12.1 [P1][依赖:11.1,11.3] 定义 AI 接管运行态模型（输入: trigger + engine response lifecycle; 输出:
  `idle/running/success/failed` + phase enum; 验证: 状态机单测覆盖成功/失败/异常中断）
- [x] 12.2 [P1][依赖:12.1] 在动作区新增运行阶段可视化（输入: 当前 run phase; 输出: 阶段进度条/节点状态; 验证: 点击后
  300ms 内可见 running）
- [x] 12.3 [P1][依赖:12.1] 增加执行日志流展示（输入: phase events + stderr/stdout summary; 输出: 追加式日志面板; 验证:
  至少显示发起/执行/收尾三类日志）
- [x] 12.4 [P1][依赖:12.1,12.3] 统一失败信息结构化呈现（输入: run error; 输出: 失败阶段+原因+建议下一步; 验证:
  失败场景文案一致且可复用）
- [x] 12.5 [P1][依赖:12.1,11.4] 显式展示刷新结果（输入: takeover 完成后 refresh outcome; 输出: 已刷新/刷新失败状态提示;
  验证: 用户可判断是否需要手工刷新）
- [x] 12.6 [P1][依赖:12.1~12.5] 增补自动化与手工验收（输入: 成功/失败/超时/刷新失败场景; 输出: 回归记录; 验证:
  typecheck + lint + 关键测试通过）

## 13. `继续/执行` 结果可视化与一键闭环（追加提案）

- [x] 13.1 [P1][依赖:3.7,12.1] 定义 `继续/执行` 统一结果卡片状态模型（输入: action trigger + runtime event; 输出:
  `idle/running/success/failed` + startedAt/elapsed + lastResult; 验证: 状态机覆盖成功/失败/超时）
- [x] 13.2 [P1][依赖:13.1] 在动作区接入“300ms 内可见运行态”反馈（输入: continue/apply click; 输出: 非静默 loading +
  禁止重复触发; 验证: 手工录屏可见首帧状态变化）
- [x] 13.3 [P1][依赖:13.1] 实现 `继续` 结构化摘要渲染（输入: instructions specs output; 输出: 本次建议摘要 + 涉及
  artifact + 下一步推荐; 验证: 有建议/无建议两类输出均可判定）
- [x] 13.4 [P1][依赖:13.1] 实现 `执行` 结构化摘要渲染（输入: instructions tasks output; 输出: 本次任务指导摘要 + 下一步推荐;
  验证: 执行后可直接引导到验证或继续）
- [x] 13.5 [P1][依赖:13.3,13.4] 增加“无新增建议”显式文案与分支（输入: 空增量输出; 输出: no-op 提示而非静默成功; 验证:
  no-op 场景不再仅更新时间线）
- [x] 13.6 [P1][依赖:13.3~13.5,11.1] 失败恢复链路接入（输入: action fail; 输出: 重试/查看原始输出/AI 接管入口; 验证:
  可修复失败场景可一键转接管）
- [x] 13.7 [P1][依赖:13.1~13.6] 增补自动化与手工验收（输入: 成功/失败/no-op/外置 spec root 场景; 输出: 回归记录; 验证:
  typecheck + lint + 关键测试通过）
