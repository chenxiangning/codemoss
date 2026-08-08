## Why

幕布架构已收敛：输入框上方的 `ComposerRunStatusStrip`（「子代理 c/t」「已编辑 +a −d」+ 展开行）成为子代理的主观察面。主幕布内并行的 S10 `SubagentSquadGrid` / `SubagentRingCard`（「N 个助手」+ 环形进度格）与 strip **功能重叠**，造成同轮双表面、纵向占用与视觉噪音。应摘除幕布小队卡，把可观测与打开 inspector 的能力收敛到 strip / StatusPanel / drawer，同时保留 tool 审计痕迹。

本 change 记录并约束**已落地实现**（working tree），并修正主 spec 与相关 active change 的契约漂移。

## 目标与边界

- **目标**：主幕布消息流 **不再** 渲染 `SubagentSquadGrid` / Ring 卡 / `subagentGroup`；子代理主表面为 Composer run-status strip（及既有 StatusPanel 列表 + inspector）。
- **幕布降级**：subagent 类 tool item **默认降级为普通 Generic 工具行**（保留审计痕迹），不隐藏 timeline 事实。
- **合成注入退役**：删除 `enrichTimelineWithSyntheticSubagentsBeforeCollapse`；无 Task 工具项的引擎在幕布不再出现合成卡，strip / status-panel 子树聚合仍覆盖子代理。
- **能力不丢**：persona 映射、状态 enrich（含 task-notification）、inspector 抽屉、StatusPanel 列表点击打开 inspector 全部保留。

## 非目标

- 不改 subagent 运行时调度、spawn 协议、session 树父子关系。
- 不删除 `isSubagentTool` 识别（strip / status-panel / enrich 仍依赖）。
- 不删除 `SubagentPersonaCard` / `SubagentProgressBar`（StatusPanel / inspector 仍用）。
- 不在本次把幕布 tool 行完全隐藏（可选后续增强）。
- 不改 `ComposerRunStatusStrip` 的 pill 布局与编辑汇总口径（已有实现为既定事实）。
- 不混入无关 multi-agent runtime 改动（见 Impact 卫生约束）。

## What Changes

### 代码（已实现，本提案验收）

1. 移除幕布 3 入口：`TimelineRowRenderer`（`subagentGroup`）、`ToolBlockRenderer`（单卡兜底）、`MessagesCore` 合成注入。
2. 还原 `groupToolItems` / projection / virtualization / renderUtils 的 `subagentGroup` special-case。
3. 删除死代码：`SubagentSquadGrid`、`SubagentRingCard`、`syntheticSharedSubagentTools` 及测试；清理 export / CSS / 10 语言 `squad*`/`statusShort`。
4. 测试更新：`groupToolItems` 断言 subagent 保持 plain item；locale parity 对齐。

### 契约（本提案补齐）

1. **MODIFIED** `subagent-canvas-persona-ui`：幕布单卡/小队网格/合成小队注入 **退役**；主表面改为 strip + StatusPanel + inspector；识别与 enrich 管线保留。
2. **ADDED** `composer-run-status-subagent-surface`：Composer run-status strip 作为子代理主表面的行为契约。
3. **MODIFIED**（相对 active delta 再 delta）`claude-subagent-canvas-surface`：canonical 完成态从 S10 幕布卡改为 strip；legacy Agent session 卡仍禁止并行。
4. **MODIFIED** `generic-tool-presentation`：subagent tool 允许以 Generic 工具行呈现（不再强制 persona/squad 承载）。

### 与既有 change 的关系（supersession）

| Change | 关系 |
|--------|------|
| `retire-claude-subagent-agent-session-card` | **部分 supersede**：其「S10 幕布卡为 canonical 完成表面」作废；「退役 legacy Agent session 卡 + notification enrich + inspector 输出」**仍有效**，enrich 宿主改为 strip 行 / StatusPanel。 |
| `fix-codex-collab-subagent-live-parity` | **部分 supersede**：幕布合成小队注入退役；wait/close 非 persona、status-panel 子树补齐 **仍有效**，观察面落到 strip。 |
| archive `enhance-subagent-canvas-persona-ui` | 历史引入 S10；本 change 将幕布呈现层回撤，保留模块与 inspector 能力。 |

## Technical Options

| Option | Summary | Trade-off |
|--------|---------|-----------|
| A. 幕布降级 Generic 工具行 + strip 主表面 | 审计保留、实现简单、与架构调整一致 | 幕布 Task 行观感变朴素 |
| B. 幕布完全隐藏 subagent tool | 更干净 | 丢审计；需上游 filter 与历史回放策略 |
| C. 保留 S10、只藏 CSS | 改动最小 | 双表面与维护成本仍在；与架构意图不符 |

**选定 A**（已实现）。

## Capabilities

### New Capabilities

- `composer-run-status-subagent-surface`：输入框上方 run-status 子代理 pill / 展开行 / 打开 inspector 的契约。

### Modified Capabilities

- `subagent-canvas-persona-ui`：移除幕布单卡/小队/合成注入 MUST；保留识别、persona 池、inspector、StatusPanel、跨引擎、状态真实性。
- `claude-subagent-canvas-surface`：canonical 表面改为 strip；禁止 legacy 卡与禁止 S10 幕布双表面。
- `generic-tool-presentation`：允许 subagent tool 以 Generic 行呈现。

## 验收标准

1. 含 subagent 的会话：主幕布 **无** 「N 个助手」/ Ring 网格 / `subagent-squad` 区块。
2. 同场景 Composer strip 显示子代理 c/t（有子代理时），展开行可见状态，点击可开 inspector。
3. 幕布仍可见对应 Agent/Task（或 spawn）**普通工具行**（非隐藏）。
4. StatusPanel 子代理列表与 enrich / inspector 路径不回归。
5. `rg "SubagentSquadGrid|SubagentRingCard|subagentGroup|squadTitleCount|statusShort" src` 无残留。
6. focused vitest（messages groupToolItems、composer run-status、subagent-ui、locale parity）与 typecheck 通过。
7. `openspec validate`（或项目等价校验）对本 change 通过。
8. commit 时 **不得** 混入无关 `multi-agent/runtime/collabThreadProcessingBridge*` 等改动（若 working tree 并存）。

## Impact

- **Frontend**：`src/features/messages/**`（group/timeline/ToolBlock/MessagesCore）、`src/features/subagent-ui/**`（删 Squad/Ring/synthetic）、`src/features/composer/components/run-status/**`（保留）、`src/styles/subagent-ui.css`、10 语言 `subagentUi`。
- **OpenSpec**：本 change + 上述 delta；archive 时 sync 主 specs。
- **Active changes**：`retire-claude-subagent-agent-session-card` / `fix-codex-collab-subagent-live-parity` 的幕布 S10 表述以本 change 为准。
- **Hygiene**：本 change 的 commit scope **仅** subagent 幕布拆除相关路径；working tree 中 `src/features/multi-agent/**`、`useThreadMessaging` / `useThreads` 等若属其他任务，必须分 commit。
