## Why

`StartupGateOverlay` 当前把 `startupTrace` 与 `runtimeNotice` 分成两列原始流水账。重复 task / command 占据大量高度，workspace 只显示截断 id，且缺少“这项后台工作在做什么”的业务说明，导致人工无法快速判断客户端启动后与运行时执行了哪些工作。诊断包虽然信息完整，但不适合作为实时阅读界面。

## 目标与边界

- 将 overlay 展开的诊断区域改为紧凑、自适应高度的单列 vertical timeline。
- timeline 明确区分“启动阶段”和“运行阶段”，不伪造两个不同 clock domain 的精确交错顺序。
- 相同 operation 仅在 `phase + operation identity + workspace/project + result status` 一致时聚合，显示执行次数与耗时摘要。
- 节点优先使用一至两行，在阅读舒适的前提下压缩高度；完整 workspace path 与细分耗时通过 hover/focus detail overlay 展示。
- 使用现有 workspace cache 将 `workspaceId` 投影为 project name 与 path；缓存缺失时安全回退原始 id。
- 每个节点提供人类可读的含义说明，同时保留 technical label 作为诊断依据。
- `buildStartupGateDiagnosticDump` 继续基于原始 events / notices 生成完整文本；一键复制的内容、顺序与详细度不变。

## 非目标

- 不处理或宣称修复当前 cold-start 卡死、main-thread stall、hydration、full-catalog、diagnostics persistence 或 renderer jank。
- 不修改 startup task 调度、timeout、cancellation、milestone、runtime notice producer 或 backend IPC。
- 不改变 `StartupGateOverlay` 默认隐藏、测试开关、force-enter、auto-close 与 platform guard 行为。
- 不把非连续失败事件并入成功节点，不以 UI 去重掩盖错误。
- 不新增 dependency，不修改 Rust / Tauri command / storage schema。

## What Changes

- 用单列 compact timeline 替换现有 `startupTrace` / `runtimeNotice` 双栏展示。
- 增加 presentation-only projection：折叠 task lifecycle、聚合重复 command / notice、计算 count 与耗时摘要，并保留异常隔离。
- 增加 operation semantic copy，使 `skills/list`、workspace refresh、session list refresh 等节点显示简短用途说明。
- timeline 节点常显 project name、次数与主要耗时；hover/focus detail 显示完整 workspace path、technical identifier、首次/最近/最慢/累计耗时等可用字段。
- 通过 3 个相同真实内容、相同 viewport 的 disposable HTML mockup 完成视觉选择，再修改 production UI。
- 增加 projection 与 component focused tests；锁定复制诊断包输出不受 timeline 聚合影响。

## 技术方案对比

1. **原始数据 + presentation projection（采用）**：保留 `startupTrace` / `runtimeNotice` 事实源，timeline 在 UI 边界聚合并解释；诊断真实性与人工可读性解耦，且无需改变 producer contract。
2. **直接修改 trace / notice producer 做全局聚合**：源头数据量更小，但会丢失完整时序、污染一键复制诊断包，并可能掩盖失败；拒绝。
3. **仅用 CSS 把现有双栏改成单栏**：改动最小，但无法折叠 lifecycle、按项目聚合或补充语义说明；不能解决核心问题，拒绝。

## 验收标准

- 展开加载日志后只出现一条 vertical timeline，并有清晰的启动/运行阶段标记。
- 普通节点默认一至两行；简单节点允许单行，警告/错误允许按需展开，不能以强制单行牺牲可读性。
- 相同 operation 在同一 project/status 下显示 `×N`；不同 project、success/failure 不得误合并。
- workspace-scoped 节点显示 project name；hover/focus 可查看完整 path，路径缺失时显示稳定 fallback。
- 聚合节点显示明确耗时语义；重复项至少可见累计或主要耗时，并在 detail 中区分可用的首次、最近、最慢与累计值。
- 每个节点包含“后台做什么”的简短说明；unknown operation 使用诚实 fallback，不编造具体业务含义。
- 键盘 focus 可访问 detail overlay，状态与耗时不只依赖颜色表达。
- 一键复制文本与变更前使用同一 raw diagnostic builder，完整事件不因 UI 聚合减少或重排。
- focused Vitest、TypeScript typecheck、target ESLint、OpenSpec strict validation 通过。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `client-startup-orchestration`: startup diagnostic presentation 增加 project-aware compact timeline、safe aggregation、semantic descriptions 与 raw-copy preservation contract。

## Impact

- UI: `src/features/app/components/StartupGateOverlay.tsx` 及可能拆出的 timeline component / projection helper。
- Tests: `StartupGateOverlay.test.tsx` 与新增的 pure projection focused tests。
- i18n: `src/i18n/locales/{zh,en}/runtimeNotice.ts` 的 timeline semantic copy。
- Read-only data reuse: startup trace、global runtime notices、sidebar workspace snapshot。
- API / backend / dependency: 无变化。
- Concurrent-work guard: 不修改当前 dirty performance chain 的 18 个文件；若实施前目标文件出现他人改动，先重新审计 diff，再做 semantic merge。
