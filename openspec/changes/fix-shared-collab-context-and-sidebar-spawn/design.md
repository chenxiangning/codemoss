## Context

阶段 1 multi-agent 用 ordinary Shared turn 驱动各 stage，node outcome 写入 `squad.nodeOutcomeRecorded`，但：

1. outcome 只落 short `summary`（plan 门闩更短）；projection 的 `fullOutcome` 实际等于 summary cap。
2. `compile_context` 的 `transform_event` 忽略 `squad.nodeOutcomeRecorded` → **AI 侧无 stage digest 通道**。
3. 工具密集 stage 的 `turnCommitted` 可能无 portable text block，destination-owned 再省略同 binding 历史 → 续聊 residual-only。
4. Sidebar hide 依赖 `nativeThreadIds`；context 注入会话标题污染（`MOSSX_CONTEXT_*`）在 hide 漏时仍可见。

## Goals / Non-Goals

见 proposal。本 design 只定实现合同。

## Decisions

### D1 — Collab stage digest 数据源：nodeOutcome.body

在 `SquadNodeOutcomeRecordedFact.outcome` 增加：

```json
{
  "schemaVersion": 1,
  "status": "succeeded|failed",
  "summary": "<short ≤160>",
  "body": "<capped full ≤ STAGE_OUTCOME_BODY_CHARS>"
}
```

- 写入时机：每个 stage 结算（成功/失败）；plan 门闩用 plan.markdown 或 raw 作 body。
- 旧事件无 `body`：compiler fallback `summary`。
- UI 右栏继续可用 projection；本 change 不要求改 Inspector。

### D2 — Compiler 一等投影 collab stage

`transform_event` 处理 `squad.nodeOutcomeRecorded`：

```text
→ PortableContextEntry
  role: "assistant"
  blocks: [{ kind: "text", text: "[协作环节 {node_id}/{status}]\n{body|summary}" }]
```

规则：

1. **不**因 destination-owned 跳过（collab digest 跨 binding 续聊必须可见）。
2. **不**因 squadWorkerBindingKey 的 attempt 集合剔除 nodeOutcome 事件本身（按 fact_type 白名单纳入；若 attempt 在 squad_attempt_ids，仍保留 nodeOutcome）。
3. 实现上：source 过滤时对 `squad.nodeOutcomeRecorded` 豁免 squad_attempt 剔除与 destination-owned 剔除。
4. Budget：body 已 cap；若总 transcript 超 budget，checkpoint 折叠时 **优先保留** collab stage 条目（category `collab-stage`）。

### D3 — 降权协作 control user turn（可选但推荐）

`conversation.turnRequested` 若 user text 含 `[[mossx.collab.briefing]]` / `[[mossx.collab.summary]]` / `【协作调度`：

- 记 omission `collab-control-prompt`，**不**注入 portable user 行（避免调度指令占满 budget 并误导 ordinary 角色）。
- 对应 assistant 若仅是调度确认短句，可保留或省略；不阻塞 G1。

### D4 — Sidebar control-plane 标题闸

在 `stripHiddenSharedBindingSummaries` 之后或合并路径中：

- 剔除 `name` / 映射标题经 `classifyContextProtocolText` 非 null 的 **native** 行（非 `shared:`）。
- 已有 hide set 逻辑保留；本闸防 orphan 泄漏。

### D5 — 范围隔离

| 路径 | 变更 |
|------|------|
| 无 collab 的 Shared ordinary | 仅 D3 在「无 marker」时 no-op |
| native list | 仅 strip，不改 native identity |
| 主幕 canvas filter | **不改** |

## Risks / Trade-offs

| 风险 | 缓解 |
|------|------|
| body 增大 event log | 已有 STAGE_OUTCOME_BODY_CHARS 硬阀 |
| checkpoint 仍挤掉 digest | 优先保留 collab-stage category |
| 双份内容（turnCommitted + nodeOutcome） | 可接受；digest 有标签；budget 下 digest 优先 |
| 标题闸误伤用户真会话名含 MOSSX | 仅 classifyContextProtocol 严格 marker 形状 |

## Migration

- 无 DB migration。
- 旧 run 无 body：summary only；用户需重新跑 stage 才有全文。

## Implementation map

| 文件 | 变更 |
|------|------|
| `agent_orchestration/commands.rs` | outcome 写 body |
| `agent_orchestration/projection.rs` | full_outcome 优先 body |
| `shared_context/compiler.rs` | transform + 过滤豁免 + 可选 control demote |
| `useThreadActions.helpers.ts` | control-plane title strip |
| foundation design md | 校准表 |
| tests | Rust compiler + FE strip |

## Open Questions

无（产品已确认：只修 AI 上下文 + 侧栏，不改人眼主幕）。
