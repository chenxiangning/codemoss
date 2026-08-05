## 1. Visual Contract

- [x] 1.1 [P0, deps: none] 输入 approved SubAgent split direction；创建 self-contained HTML Visual Companion（entry、plan、run、overview/detail、Stop、mobile）；输出项目内 preview；验证 Playwright console/pageerror、desktop/mobile screenshots 与交互状态。

## 2. Inspector Host And State Boundary

- [x] 2.1 [P0, deps: 1.1] 输入 existing `SubagentChatSplit`；抽取 `ConversationInspectorSplit` generic host并保留 compatibility wrapper；输出不 remount Messages 的 desktop/mobile split；验证现有 SubAgent tests + resize/focus tests。
- [x] 2.2 [P0, deps: control-plane 3.2] 输入 `SquadProjectionV1` service；实现 session-scoped external store、mapping、referential no-op与 event-coalesced refresh；输出 feature hook selectors；验证 A/B isolation and semantic no-op tests。

## 3. Conversation Entry And Cards

- [x] 3.1 [P0, deps: 2.2] 输入 Shared Composer send contract；新增 send 左侧 one-shot Squad control与 request envelope；输出 Native-hidden/Shared-visible behavior；验证 mode consume/failure draft/target freeze/IME tests。
- [x] 3.2 [P0, deps: 2.2,3.1] 输入 proposed/running projection；实现 `SquadPlanCard` 与 `SquadRunCard` actions；输出 one-confirmation、progress、reopen inspector、Stop entry；验证 no-worker-before-approval and duplicate-card tests。

## 4. Right Inspector

- [x] 4.1 [P0, deps: 2.1,2.2,3.2] 输入 run/node selectors；实现 overview、compact DAG list、detail/evidence/artifacts/diagnostics panels；输出 full-height inspector；验证 projection authority and no prose inference tests。
- [x] 4.2 [P1, deps: 4.1] 输入 i18n/accessibility requirements；实现 localized copy、keyboard separator、focus open/restore、mobile focus trap、reduced motion；输出 accessible UI；验证 axe-style semantic assertions和 keyboard tests。
- [x] 4.3 [P1, deps: 4.2] 输入 UI components；添加 feature-local CSS/token integration与 sanitized persisted ratio；输出 desktop/mobile/dark/light parity；验证 visual screenshots and large-file gate。

## 5. Gates

- [x] 5.1 [P0, deps: 2.1-4.3] 输入 frontend implementation；运行 focused Vitest、typecheck、lint、messages boundaries、runtime contracts、branding与large-file checks；输出零新增 renderer warning。
- [ ] 5.2 [P1, deps: 5.1] 输入 production build/runtime；手工验证 Shared-only entry、one confirm auto-open、close/reopen、typing under updates、Stop explanation、SubAgent parity；输出 manual test evidence。
- [x] 5.3 [P0, deps: 5.1] 输入 Native/Shared navigation regression evidence；隔离 passive Squad hydration、保持 Canvas owner scope 原子性并丢弃 stale visible errors；验证 Native zero-call、non-Squad zero-Toast、cross-workspace owner pairing 与 stale rejection tests。
- [x] 5.4 [P0, deps: 5.3] 输入 canonical Shared history projection；删除 Shared identity 即 Squad 的全局被动探测，增加 exact evidence gate、one-shot claim 与 in-flight single-flight；验证 100 个 ordinary Shared switches 零 Squad command、real Squad 单次 hydration、feature-off 与 malformed/prose evidence fail-closed。
