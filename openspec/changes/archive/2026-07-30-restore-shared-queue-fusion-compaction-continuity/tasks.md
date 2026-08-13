## 1. Runtime 事实与 Compaction Barrier（P0）

- [x] 1.1 修正 Shared Codex nested terminal status normalization，并用 focused Rust test 验证 `replaced` 不再落成 `completed`
- [x] 1.2 为 `AutoCompactionThreadState` 增加 high-watermark latch、user dispatch reservation、manual request 与 bounded timeout
- [x] 1.3 在 Codex `turn/start` 前接入 native-thread barrier，并验证 compaction-first / send-first 两种竞态顺序
- [x] 1.4 让 Shared manual compact 从 durable Target/Binding 解析 Codex/Claude exact route，unsupported engine fail closed

## 2. Shared Queue / Fusion（P0，依赖 1）

- [x] 2.1 为 Shared queue item 冻结并持久化 payload、Execution Target 与 predecessor Attempt identity
- [x] 2.2 贯通 Shared V2 typed result，queue item 仅在 matching canonical commit ACK 后移除
- [x] 2.3 解锁 Shared `running` / `settling` follow-up admission，保持 pre-acceptance 与 ambiguous states 锁定
- [x] 2.4 将 `compat-input` 从 same-run steer 收敛为 interrupt / settle / successor cutover，并验证 continuation evidence

## 3. Lifecycle UI 与 Contract（P1，依赖 1-2）

- [x] 3.1 将 existing active-thread compaction lifecycle scalar 投影到 Shared Composer，禁止恢复逐 delta root dispatch
- [x] 3.2 更新 `dev-guidelines/backend/shared-session-v2-send-contract.md` 的 executable contract 与 focused commands

## 4. 增量验证与闭环（P0，依赖 1-3）

- [x] 4.1 运行受影响 Vitest、TypeScript typecheck、focused Rust tests、`cargo fmt --check` 与 targeted `cargo check`
- [x] 4.2 执行 `check`、`check-cross-layer`、人工 diff review 与 `openspec-verify-change`
- [x] 4.3 严格校验 OpenSpec change；保留未执行的真实环境手工竞态复现为显式 waiver，不伪造结果
  - Waiver：本轮未执行 Codex/Claude 真实 CLI + GUI 的人工竞态复现；以 focused Vitest、Rust race tests、typecheck、runtime-contract/perf gates 与 OpenSpec strict validation 作为自动化证据，真实环境复现留给后续人工验收。
- [x] 4.4 按逻辑批次提交代码/规范，并完成 Trellis post-commit session record
