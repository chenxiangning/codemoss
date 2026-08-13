## 1. Codex Target Identity

- [x] 1.1 [P0][无依赖] 修改 `execute_codex`：输入为 `thread/start` raw id，输出 operation
  `resultSessionId`、metadata target 与 frontend selection 均保持 raw id；用 focused Rust 与
  hook tests 验证，同时保留 legacy prefixed recovery。
- [x] 1.2 [P0][依赖 1.1] 在 session catalog metadata lookup/record path 加入 duplicated Codex
  key compatibility 与 exact-source recursive Family resolver；用 Rust tests 覆盖 raw row、
  legacy key、两级 chain 与 cycle。

## 2. Structured Import Presentation

- [x] 2.1 [P0][无依赖] 修改 `codex_import_projection`，输出首 package marker、portable items、
  尾 accepted marker；用 Rust test 锁定 marker 顺序与 matching identity。
- [x] 2.2 [P0][依赖 2.1] 修改 `contextProtocol` presentation filter，以 identity-aware stack
  隐藏完整
  envelope 并保留 native/shared legacy semantics；用 utility/Messages Vitest 覆盖 nested
  user/developer history、旧版未闭合 package、普通后续 turn 与普通 marker discussion。
- [x] 2.3 [P0][依赖 2.2] 将 authoritative `provider-continuation` metadata 传入 Messages
  presentation boundary；仅对 Codex target 隐藏 control prompt 之前的 host bootstrap 与其
  bootstrap assistant output，直到第一条真实 user turn。普通 Codex Session 与 Shared V2
  conversation MUST 保持原展示语义。
- [x] 2.4 [P0][依赖 2.3] 在 continuation ready 后等待现有 workspace catalog hydration
  完成，再关闭 Dialog 并选择 target；不得新增轮询、timeout 或 provisional Session state。
  用 deferred Promise test 证明 refresh settle 前 target 不会进入 Canvas。

## 3. Contract Sync And Verification

- [x] 3.1 [P1][依赖 1.1、1.2、2.1、2.2] 更新
  `dev-guidelines/backend/native-provider-continuation-contract.md`，写明 raw target identity、
  legacy key alias、recursive Family 与 closed import envelope 的 executable contract。
- [x] 3.2 [P0][依赖全部实现] 执行 focused Rust/Vitest、`npm run typecheck`、
  `npm run check:runtime-contracts`、lint 与
  `openspec validate fix-codex-provider-continuation-projection --strict --no-interactive`；
  验证不触碰工作区无关变更。
- [x] 3.3 [P0][依赖 2.3] 更新 executable contract，并重新执行 contextProtocol/Messages/
  layout focused Vitest、typecheck、lint 与 OpenSpec strict validation，证明新 gate 不影响
  普通 Codex Session。
- [x] 3.4 [P0][依赖 2.4] 重新执行 Sidebar continuation、Messages/layout focused Vitest、
  typecheck、lint、runtime contracts 与 OpenSpec strict validation，证明首帧无 bootstrap
  闪烁且不增加 root render hot-path state。
