## Context

现有 `SubagentChatSplit` 已解决桌面右侧 full-height drawer、ratio persistence、mobile overlay 与 Messages 不 remount。它目前直接绑定 `SubagentInspectorDrawer`。Squad 需要同一 interaction shape，但 domain 不能耦合到 engine-native SubAgent。

## Goals / Non-Goals

**Goals:**

- Composer send 旁一个 explicit one-shot Squad entry。
- Conversation 内 plan/run card 与右侧 overview/detail inspector 协同。
- 复用 split host，保持 Messages/composer identity 与 streaming performance。
- projection-driven、accessible、localized、responsive。

**Non-Goals:**

- 新页面、Task Center、sidebar primary navigation。
- 普通 Native session 支持。
- frontend scheduler/terminal inference。

## Decisions

### 1. Generic Conversation Inspector Host

抽取：

```tsx
<ConversationInspectorSplit
  inspector={activeInspectorNode}
  isOpen={isInspectorOpen}
  onClose={closeInspector}
>
  {conversationNode}
</ConversationInspectorSplit>
```

`SubagentChatSplit` 保留为 compatibility wrapper，将 existing subagent props 映射到 generic host。Squad 使用独立 adapter。这样现有 tests/API 不需要一次性迁移。

Split ratio 使用 generic conversation-inspector key：

- `conversationInspectorSplitRatio` 为新 owner并 clamp。
- 首次读取兼容旧 `subagentChatSplitRatio`，之后统一写新 key。

Messages subtree 作为 stable `children` 保持 mounted；切换 inspector 只替换右侧 node。

### 2. Composer One-Shot Entry

`Squad` button 通过 `squadSurface` slot 放在 `.button-area-right` 中、紧邻 send 左侧。只在 resolved Shared Session、feature flag enabled、无 active run 时可 armed。

状态：`off -> armed -> consumed -> off`。send-critical text/attachments/target 保持原 owner；Squad 只给 send envelope 增加 `requestMode: "squad"`。send 失败时 draft 不丢，armed state 恢复为可重试。

### 3. Conversation Cards

- `SquadPlanCard`: objective、nodes、sealed target、budgets、permissions、editable budgets/attempts、Confirm。
- `SquadRunCard`: overall status、active/complete counts、current phase、budget、Open Inspector、Emergency Stop。

cards 是 projection presentation，不推断 terminal；actions 调 service command，成功 response刷新 session-scoped external store。card surface保持在 Messages 与 Composer 之间；canonical `SquadRunRequested` 与 successful settlement同时保证 user/final message进入历史 projection。

### 4. Right Inspector Information Architecture

```text
Header: Squad / status / elapsed / close
Overview:
  Progress + budget
  DAG node list (status, target, dependency)
  Verification summary
Detail:
  Goal + immutable target
  Context manifest
  Attempt timeline
  Outcome/evidence/artifacts
  Diagnostics / blocked reason
Footer (running): Emergency Stop
```

V1 不引入 graph dependency。Desktop 使用 compact DAG list + connector CSS；node count 超过 100 时才启用 existing virtualization dependency。一般 run 受 plan validator 限制在小规模。

### 5. Projection Subscription and Render Boundary

新增 feature-local external store，`useSyncExternalStore` snapshot 按 `workspaceId + sharedSessionId` 缓存并以 semantic signature保持 referential stability。Shared history loader 复用已经加载的 canonical projection item 建立精确 `workspaceId + threadId + runId` evidence；Conversation surface 只有在 feature enabled 且 evidence 存在时才允许一次 passive hydration，concurrent callers 共享 single-flight request。普通 Shared/Native browsing 不发 Squad discovery command，不从 transcript prose 或 `presentation-only` item 推断 Squad。当前 V1 在 command response、attempt boundary与 evidence-gated hydration时发布 projection；Worker raw realtime event在 root event bridge按 durable `bindingKey=squad:*` fail closed抑制。

root AppShell 只持有低频 `activeInspectorKind/id`，不持有 events/log arrays。Composer 输入、IME、draft、attachments 永不进入 deferred path；Squad progress 不作为 Messages timeline source。

### 6. Accessibility and Responsive

- button、status、stop、close、node rows 全部 i18n 与 accessible name。
- keyboard：Space/Enter arm；Escape 关闭 inspector但不 cancel run；Stop 需 domain dialog confirmation。
- focus：approval 后 auto-open inspector并聚焦 heading；close 后回到 run card trigger。
- desktop draggable separator 提供 `role=separator` 与 keyboard resize。
- mobile inspector overlay，focus trap/restore；`prefers-reduced-motion` 移除位移动画。

## Risks / Trade-offs

- [generic split 抽取回归 SubAgent] → compatibility wrapper + existing SubAgent focused tests + no prop behavior change。
- [node updates拖慢 typing] → external store、session-scoped selector、stable snapshots；不提升 event arrays 到 root。
- [小屏信息密度过高] → overview/detail 两级，mobile overlay 单列。
- [自动打开 inspector 打断用户] → 只在 explicit plan approval 后一次打开；后续 node events 不抢 focus。

## Migration Plan

1. 先抽 generic host并让 existing SubAgent wrapper通过原 tests。
2. 添加 HTML Visual Companion 与 viewport/interaction verification。
3. feature flag 下接 Composer、cards、inspector。
4. flag off 时不显示入口；历史 run card仍可通过 projection read-only展示（若产品 flag policy允许）。

## Open Questions

无。用户已指定沿用当前客户端 SubAgent 右侧抽屉形态。
