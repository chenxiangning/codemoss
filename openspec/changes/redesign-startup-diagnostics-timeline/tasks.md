## 1. Visual Preview Gate

- [x] 1.1 [P0][depends:none][I: screenshot、现有 theme 与真实 startup/runtime sample][O: 3 个相同 viewport 的 disposable HTML mockup][V: browser render + screenshot + console error=0] 生成 adaptive compact、dense inline、section rail 三个 timeline variation；preview 不进入 production source 或 Git。
- [x] 1.2 [P0][depends:1.1][I: 3 个 mockup][O: 用户确认的 visual direction 与必要微调记录][V: 用户在对话中明确选择/批准] 完成 UI preview Gate；采用 A `adaptive compact`，并按“阅读舒适前提下尽量压缩高度”调整。

## 2. Collision Guard And Task Context

- [x] 2.1 [P0][depends:1.2][I: 当前 git status/diff 与并行 cold-start change][O: 本 change 独占文件清单和 capability matrix][V: `git diff --name-only` + target-file diff 审计] 初检目标 files clean；实施前发现并行 change 删除 overlay `scrollIntoView` 并新增 passive-diagnostics test，已纳入 capability matrix，后续 semantic merge 必须保留；其余 performance/cold-start dirty files 全部只读。
- [x] 2.2 [P1][depends:2.1][I: OpenSpec artifacts 与 Trellis frontend specs][O: 关联 `redesign-startup-diagnostics-timeline` 的 active Trellis task/context][V: `task.py` context/status 可读取] 已创建并激活 `.trellis/tasks/08-09-redesign-startup-diagnostics-timeline`，context validation 通过。

## 3. Timeline Projection

- [x] 3.1 [P0][depends:2.2][I: raw `StartupTraceEvent[]`、`GlobalRuntimeNotice[]`、sidebar workspace snapshot][O: pure timeline projection 与 view model][V: focused unit tests] 折叠 task lifecycle，按 section/operation/project/status 安全聚合 command/task/notice，并计算 count、single/first/latest/max/total duration。
- [x] 3.2 [P0][depends:3.1][I: technical labels 与 i18n registry][O: known-operation semantic title/description + honest fallback][V: known/unknown label unit cases] 覆盖 workspace/session refresh、skills、prompts、commands、collaboration modes、models、Git 与 milestone；禁止编造 source 未提供的数据。
- [x] 3.3 [P0][depends:3.1][I: workspace id + sidebar snapshot][O: project name/path resolver][V: name/path-basename/id fallback cases] 常显 project label，detail 提供完整 path；cache miss 不触发新 IPC。
- [x] 3.4 [P0][depends:3.1,3.2,3.3][I: mixed trace/notice fixtures][O: clock-domain、dedupe、failure isolation regression suite][V: Vitest pass] 锁定 trace sequence、runtime wall-clock ordering、startup-mirrored notice 去重、跨 project 不合并与 failure 不吞并。

## 4. Compact Timeline UI

- [x] 4.1 [P0][depends:3.4][I: approved mockup + projected view model][O: adaptive compact vertical timeline component][V: component tests + browser visual check] 实现一至两行自适应节点、阶段 marker、bounded scroll、project/count/duration 常显与可读状态 marker。
- [x] 4.2 [P0][depends:4.1][I: path/technical/timing detail][O: hover/focus/click detail overlay][V: keyboard/accessibility tests] 完整 path、technical identifier、首次/最近/最慢/累计耗时可访问，关键信息不只依赖颜色。
- [x] 4.3 [P0][depends:4.1,4.2][I: existing `StartupGateOverlay` panel][O: 双栏替换为单轴 timeline][V: existing + updated overlay tests] 保留 expand/collapse、copy state、timer、force-enter、auto-close、platform guard 与 test opt-in 行为。
- [x] 4.4 [P0][depends:4.3][I: raw diagnostic fixtures][O: unchanged diagnostic dump contract][V: exact/raw event assertions] 证明 UI 聚合不减少、重排或改写一键复制诊断包。

## 5. Quality And OpenSpec Closure

- [x] 5.1 [P0][depends:4.4][I: touched frontend files][O: focused quality evidence][V: focused Vitest + `npm run typecheck` + target ESLint] 运行相关 tests、typecheck 与 lint；不得引入新 warning。
- [x] 5.2 [P1][depends:5.1][I: changed file sizes/tests][O: repository guard evidence][V: large-file near-threshold/gate + heavy-test-noise checks as applicable] 确认拆分没有扩大 `StartupGateOverlay.tsx` 大文件债务或 test noise。
- [x] 5.3 [P0][depends:5.1,5.2][I: implementation + artifacts][O: verification report][V: `openspec validate redesign-startup-diagnostics-timeline --strict --no-interactive`] 执行 OpenSpec verify，核对每个 requirement 与实现证据；记录任何 manual QA 未完成项。
- [ ] 5.4 [P0][depends:5.3][I: verified delta spec][O: synced main spec and archived change][V: strict main-spec validation + archive path exists] 在无未决 requirement、无 collision 且用户验收后执行 sync/archive；不使用 `--skip-specs`，除非先证明 main spec 已等价同步。
