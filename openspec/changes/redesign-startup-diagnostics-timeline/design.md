## Context

`StartupGateOverlay` 当前直接把 `StartupTraceEvent[]` 映射为左栏 rows，并把 `GlobalRuntimeNotice[]` 映射为右栏 rows。两套数据有不同时间语义：startup trace 的 `timestamp` 来自 `performance.now()`，runtime notice 的 `timestampMs` 是 wall-clock；现有代码因此明确选择分栏，而不是伪造统一 sequence。

现有事实源已经提供本变更所需的大部分字段：

- startup task / command：phase、workspace scope、lifecycle/status、duration、sequence、technical label。
- runtime notice：category、severity、dedupe key、repeat count、message params、wall-clock timestamp。
- sidebar snapshot：`WorkspaceInfo.id/name/path`，可把 trace 的 workspace id 解析为 project name 与完整路径。
- diagnostic dump：直接读取 raw events / notices，并输出完整 chronology、cost rank 与 message params。

当前 worktree 另有 cold-start / renderer diagnostics 性能链路正在修改。该链路的 dirty files 均视为外部并行工作，本 change 必须保持 presentation-only，并在每次落盘前确认目标文件没有新增未提交改动。

## Goals / Non-Goals

**Goals:**

- 以一条紧凑 vertical timeline 解释客户端启动与运行时的后台工作。
- 普通节点在美观和阅读舒适的前提下优先一至两行，避免机械强制单行或无界纵向展开。
- 安全聚合重复 operation，按 project/status 隔离，并展示 count 与明确的 duration semantics。
- 常显 project name；按 hover、keyboard focus 或触发操作显示完整 path 与耗时明细。
- 为已知 operation 提供精确 semantic copy；未知 operation 保留 technical label 并使用诚实 fallback。
- 保持 raw diagnostic copy 完全独立，确保 UI 聚合不改变证据。

**Non-Goals:**

- 不改变 startup scheduler、trace emitter、runtime notice producer、backend IPC 或 persistence。
- 不修复 cold-start stall、render jank、full-catalog 或 thread hydration。
- 不改变 overlay 的 mount policy、test switch、timer、force-enter 与 auto-close。
- 不增加新的全局 store、polling、listener 或 dependency。

## Decisions

### D1. 使用纯 presentation projection，不修改 facts

新增 pure projector，将 raw `StartupTraceEvent[]`、`GlobalRuntimeNotice[]` 与 workspace lookup 投影为 timeline view model。projection 负责 lifecycle folding、aggregation、description resolution 与 duration stats；source arrays 和 `buildStartupGateDiagnosticDump` 不变。

**Alternatives:**

- 在 producer 层直接 dedupe：会丢失 chronology 与 failure evidence，拒绝。
- 继续在 JSX 内临时拼 row：`StartupGateOverlay.tsx` 已接近大文件阈值，且 aggregation 难以独立测试，拒绝。

### D2. 单视觉轴分阶段，不跨 clock domain 伪排序

timeline 使用共同的垂直视觉语言，但保留两个明确 section：

1. `启动阶段`：按 startup trace sequence 展示 task、command 与 milestone projection。
2. `运行阶段`：按 runtime notice wall-clock 顺序展示非镜像 runtime/workspace/error notice。

由 startup trace 镜像产生的 `runtimeNotice.startup.*` diagnostic notice 不在运行阶段重复展示。bootstrap-only notice 可归入启动 section 的提示节点，但不得与 trace event 声称毫秒级精确交错。

**Alternatives:**

- 把两个 timestamp 直接 sort：单位与 epoch 不同，会制造错误 chronology，拒绝。
- 保留双栏：无法形成用户要求的单轴阅读路径，拒绝。

### D3. 聚合 key 必须保留 project 与 result boundary

projection 使用稳定 semantic key：

```text
section + event kind + normalized operation + workspace/project identity + result bucket
```

- command：每个 raw command event 代表一次 execution；相同 key 聚合。
- task：先把同一 execution 的 queued/started/terminal lifecycle 折叠为最终态，再按 semantic key 聚合；不能把 lifecycle event 数误当执行次数。
- notice：沿用 source `repeatCount`，仅在 projection 需要时按 dedupe identity 组合。
- success、running、failed/timed-out/degraded/cancelled 必须分开；failed item 永不吞入 success count。
- 同 operation 在不同 workspace/project 下必须分开。

重复节点常显 `×N` 与 `累计耗时`；detail 在字段可用时展示首次、最近、最慢、累计。单次节点常显该次 duration。没有 duration 时显示 `—`，禁止猜测。

### D4. workspace label 使用现有 sidebar snapshot，缺失时降级

overlay mount 时从现有 sidebar snapshot 建立只读 `workspaceId -> {name,path}` lookup。展示优先级：

1. 非空 workspace name；
2. path basename；
3. 完整或截断 workspace id fallback。

完整 path 只放 detail overlay，避免主 timeline 被长路径撑高。snapshot 缺失或损坏时不得发起额外 IPC，也不得阻断 timeline。

**Alternatives:**

- 为 overlay 新增 workspace-list IPC：会把诊断 UI 变成新的 startup work，拒绝。
- 扩展每个 trace payload 携带 name/path：扩散到所有 producer，超出 presentation scope，拒绝。

### D5. semantic copy 使用 i18n registry + honest fallback

已知 operation 通过 normalized technical label 映射到 i18n title/description，例如 workspace catalog、thread/session list、skills、prompts、commands、collaboration modes、models、Git status/diff 与 milestones。description 说明“后台做什么/用于什么”，不虚构结果数量或未采集的数据。

unknown operation 显示原始 label，并使用通用说明“执行启动后台任务”或“执行内部命令”；detail 保留 technical identifier，避免 UI 文案冒充事实。

### D6. timeline component 与 projector 从 overlay 拆出

`StartupGateOverlay` 保留 timer、copy、force-enter 与 panel toggle owner；新的 timeline component 只消费 view model 并 render。pure projector 与 UI component 使用 colocated focused tests。拆分目标是控制现有大文件增长，不创建通用 timeline framework。

### D7. 节点采用 adaptive compact density

节点 anatomy：

- primary row：status marker、title、project、count、duration。
- secondary copy：仅在有意义时出现，普通节点最多保持简短说明；简单 milestone 可单行，warning/error 可按需展开。
- technical/path/timing breakdown：放在 hover/focus detail overlay。

详情 trigger 必须可键盘 focus，并提供可访问名称；关键信息不能只依赖颜色。移动端或无 hover 环境可通过 focus/click 查看 detail。panel 保留 bounded height 与内部 scroll。

### D8. production 修改前执行 disposable visual gate

先使用相同真实内容和相同 viewport 生成 3 个 HTML mockup：

- A：adaptive compact（推荐）：一至两行节点 + hover/focus detail。
- B：dense inline：更多 metadata 常显。
- C：section rail：阶段标签更强、节点更紧凑。

preview 文件仅作为 disposable artifact，不进入 production source 或 Git。用户明确选择/批准后才修改产品代码。

### D9. 并行工作区采用 file-level collision guard

实现前和每次修改前检查目标文件 diff。若 `StartupGateOverlay.tsx`、相关 tests/i18n 或拟新增路径出现他人未提交修改，停止直接落盘，先列 capability matrix 并做 semantic merge；不得用整文件覆盖。

## Risks / Trade-offs

- [workspace snapshot 可能为空或稍旧] → 只影响 display label；回退 workspace id，不发额外 startup IPC。
- [聚合隐藏慢调用离散度] → detail 显示首次/最近/最慢/累计；failure 永远独立。
- [semantic registry 无法覆盖未来 operation] → honest fallback + technical identifier，未知项仍可诊断。
- [hover-only 对键盘/触屏不可达] → 同一 detail 支持 focus/click，并提供 ARIA 语义。
- [timeline projection 随每个 trace event 重算] → raw buffer 最大 400；使用 pure linear projection + component-level memo，不接入 AppShell root chain。
- [并行性能变更随后触及相同文件] → 落盘前重新检查 dirty targets；冲突时按 semantic merge 处理。
- [单列可能比双栏更长] → safe aggregation、adaptive one/two-line density、bounded scroll；不通过压缩字号牺牲可读性。

## Migration Plan

1. 创建并展示 3 个 disposable mockup，记录用户选择。
2. 增加 pure timeline projector 与 focused unit tests。
3. 增加 compact timeline component、i18n semantic copy 与 accessibility behavior。
4. 在 `StartupGateOverlay` 中替换双栏 render，保留 panel toggle、copy、timer 与 raw dump owner。
5. 运行 focused tests、typecheck、target ESLint、OpenSpec strict validation与浏览器目视检查。
6. 回滚时恢复原双栏 render 并删除新增 presentation files/i18n keys；无 data migration、backend rollback 或 storage cleanup。

## Visual Decision

- 采用 A：`adaptive compact`。常规节点优先一至两行，简单 milestone 可单行；project、count 与主要 duration 常显，完整 path、technical identifier 与 timing breakdown 通过 hover/focus/click detail overlay 展示。
- 用户补充要求：不是完全禁止多行，而是在美观与阅读舒适的前提下压缩高度。
