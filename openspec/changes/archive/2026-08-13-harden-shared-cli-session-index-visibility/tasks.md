## 1. Durable ownership projection（P0，依赖：无）

- [x] 1.1 实现只读 `SharedNativeVisibilityProjection` reader：输入 workspace V0 Shared metadata + 只读 `shared_binding_state`（当前 `native_session_id` + `archivedNativeSessionId`）+ 有界 binding 事件历史 id；输出 normalized hidden ids、availability/freshness/reason。禁止走 `SharedEventWriter` actor。单测覆盖 legacy-only、V2-only、archived、双来源重叠、空 workspace、只读超时/失败。
- [x] 1.2 将 projection 挂到 `list_session_index_for_workspace` 同次返回；从 Index 未 sanitize 的 title/nativeTitle 收集精确 MOSSX protocol-hidden ids。验证该路径不触发 full catalog / transcript / 无界 JSONL scan。
- [x] 1.3 Claude writer 在 bounded header / `subagent:{parent}:{agent}` 能解析时写入 `parent_session_id`；验证普通 `Claude Session` / `Agent N` 不会仅因标题进入 protocol-hidden。

## 2. Sidebar projection guard（P0，依赖：1.1、1.2）

- [x] 2.1 抽取纯 Shared-native owner predicate（raw/prefixed id + durable hide + protocol-hidden）；`shared:*` 永不被该 predicate 隐藏。
- [x] 2.2 修改 Session Index first-paint：仅在 projection 可用或存在 last-verified hide 时 dispatch ordinary native rows；unavailable 且无 verified hide 时保持 last-good / pending，禁止空 hide 写入。
- [x] 2.3 soft refresh、continuity/fallback、final gate 复用同一 predicate，并对 verified hide 取并集；验证迟到 Shared snapshot 不会把已隐藏 binding 重新引入；unfiltered Index 行不得进入 last-good。
- [x] 2.4 保持 `parentThreadId` Shared 下崽、re-parent、canvas 与 Strip 不变；验证 owner-id projection 不改变普通 native parent-child 规则。

## 3. Regression tests and contract alignment（P0，依赖：1、2）

- [x] 3.1 Rust Session Index / visibility 测试：V2-only、legacy、archived、raw/prefixed、unavailable、protocol 正反例；每条同时证明不扩大 Index scan。
- [x] 3.2 Vitest 首屏回归：cold start Shared owner 在首个 `setThreads` 前被排除；delayed/failed snapshot、abandon、later merge、正常同名 native、`shared:*` canonical row。
- [x] 3.3 复跑并补强 `useThreadRows`、`sharedSessionSummaries`、`useThreadActions.helpers` 的 focused tests，断言 native lifecycle 与已验收 parent-tree hide 未变。
- [x] 3.4 更新 `dev-guidelines/guides/workspace-session-catalog-contract.md`：Index 必须携带 durable ownership（含 archived/历史 id）、partial availability、禁止 title-based hide、visibility 不得走 EventWriter actor。

## 4. Verification and release evidence（P1，依赖：1、2、3）

- [x] 4.1 `openspec validate harden-shared-cli-session-index-visibility --strict --no-interactive` 与 `openspec validate --all --strict --no-interactive`；修复本 change 引入的规范错误。
- [x] 4.2 受影响 Rust `cargo test` 子集、受影响 Vitest 与 `npm run typecheck`；基线已有失败则证明失败集未扩大。
- [x] 4.3 手动验收 cold start / soft refresh / Shared rebuild：无 Shared-owned `Claude Session` 常驻或闪现；正常 native 同名仍可见；trace 证明未回退 full-catalog。收口记录见 `verification.md`：自动化门禁 + 双轮审查通过；实机 GUI 抽查列为 residual。
- [x] 4.4 收口前按基石 ADR 触发器复核；若命中 canonical fact / Shared support，回写 foundation 校准表。
