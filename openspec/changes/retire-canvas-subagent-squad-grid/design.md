## Context

### 双表面现状（改前）

```
消息流 ConversationItem(tool, isSubagentTool)
  └─ groupToolItems → subagentGroup（1 项也强制分组）
       └─ TimelineRowRenderer → SubagentSquadGrid（「N 个助手」+ 分段条 + Ring 卡）
            兜底：ToolBlockRenderer 单卡 → SquadGrid
            合成：MessagesCore → enrichTimelineWithSyntheticSubagentsBeforeCollapse

Composer
  └─ ComposerRunStatusStrip（子代理 c/t · 已编辑 +a −d）
       └─ RunStatusSubagentRows → buildSubagentCardFromSubagentInfo + enrich → openSubagentInspector
```

两者共享 `subagent-ui/utils` 视图模型、`activeCanvasStore`、inspector store；**仅展示层重复**。

### 产品决策

幕布架构调整后：子代理观察与入口收敛到 **对话框上方 strip**；幕布只保留 tool 审计行，不再承载小队 UI。

### 相关历史

- S10 引入：archive `enhance-subagent-canvas-persona-ui`
- 跨引擎识别：archive `adapt-subagent-cross-engine-display`
- Claude 旧卡退役并迁 S10：active `retire-claude-subagent-agent-session-card`（本 change **再迁** canonical 表面到 strip）
- Codex live 合成：active `fix-codex-collab-subagent-live-parity`（本 change **退役幕布合成**，观察面靠 status-panel 子树）

## Goals / Non-Goals

**Goals**

1. 幕布零 Squad/Ring 像素；零 `subagentGroup` kind。
2. strip 为子代理主表面；inspector 入口不丢。
3. tool 事实仍以 Generic 行可审计。
4. 主 spec 与实现一致，消除 contract drift。

**Non-Goals**

1. 重做 strip 视觉（方案 A 已定）。
2. 隐藏或重写 subagent tool 识别。
3. 改 session 树 / spawn 执行。
4. 一次性 archive 所有相关 active change（可后续各自 verify）。

## Decisions

### D1 — 幕布降级为 plain tool item（方案 A）

- `groupToolItems` 不再将 `subagent` 列入 `GroupableCategory`。
- `classifyToolCategory` 仍可返回 `subagent`（供识别/统计），但 **不** 产生 group entry。
- `ToolBlockRenderer` 不再 special-case `isSubagentTool` → SquadGrid；走 Generic 扳手行。
- **不** 在 timeline 层 filter 掉 subagent tool。

### D2 — 删除合成注入，不迁到幕布替代 UI

- 删除 `syntheticSharedSubagentTools` 与 MessagesCore 注入。
- Shared / Codex 无 spawn 工具时：幕布不再出现合成卡。
- 子代理可见性依赖 `useStatusPanelData` 聚合（含 collab 子树补齐）→ strip / StatusPanel。

### D3 — enrich 宿主迁移

- task-notification enrich、status enrich 继续由 `RunStatusSubagentRows` 与 `SubagentList` 调用（同一套 pure utils）。
- inspector 打开路径：`openSubagentInspector(card)` 不变。
- 不再存在「点幕布 Ring 卡」入口。

### D4 — 死代码与 i18n 同步删除

- 组件：`SubagentSquadGrid`、`SubagentRingCard`。
- i18n：`squadTitle`、`squadTitleCount`、`statusShort.*`（10 locale + parity）。
- CSS：`.subagent-squad` / ring 相关段。
- **保留**：`status.*`、`defaultName`、inspector 文案、Persona/ProgressBar。

### D5 — 契约 supersession 写法

- 主 capability `subagent-canvas-persona-ui` 用 MODIFIED/REMOVED 语义改写幕布呈现要求。
- 对仍 active 的 `claude-subagent-canvas-surface` 再发 delta：canonical = strip，禁止 S10 幕布与 legacy 卡。
- design/tasks 标注与 `fix-codex-collab-subagent-live-parity` 幕布合成冲突以本 change 为准。

### D6 — Commit 卫生

Working tree 若混有 `multi-agent/runtime/collabThreadProcessingBridge*`、`useThreadMessaging`/`useThreads` 等，**不得** 与本 change 同 commit。

## Architecture (after)

```
isSubagentTool / classifyToolCategory("subagent")
  ├─ 幕布：plain tool item → GenericToolBlock（审计）
  ├─ status-panel：SubagentInfo[] 聚合
  │    └─ SubagentList → PersonaCard 行 + inspector
  └─ ComposerRunStatusStrip
       └─ pill c/t + RunStatusSubagentRows → enrich + inspector

SubagentInspectorDrawer / SubagentSessionCanvas / ProgressBar 保留
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Codex live 无 spawn 时用户以为「子代理消失」 | strip/StatusPanel 子树补齐；验收用例覆盖 |
| Claude 用户习惯点幕布卡 | strip 展开行 + 列表仍可点；文档/验收说明 |
| 与 `retire-claude-subagent` 表述冲突 | 本 change delta 明确 supersede canvas S10 |
| 无关 diff 误提交 | D6 强制分 commit；tasks 勾选 scope 检查 |

## Test Plan

- unit：`groupToolItems` plain item；locale parity；run-status rows open inspector
- typecheck 全量（`subagentGroup` 类型删除）
- `rg` 残留哨兵
- 手工：Claude Agent、Codex collab、Shared 多子代理 — 幕布无小队、strip 可用
