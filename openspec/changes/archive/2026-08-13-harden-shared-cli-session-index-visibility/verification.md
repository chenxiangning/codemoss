# Verification — harden-shared-cli-session-index-visibility

## Automated

| Check | Result |
|-------|--------|
| `openspec validate harden-shared-cli-session-index-visibility --strict --no-interactive` | pass |
| `cargo test --manifest-path src-tauri/Cargo.toml --lib shared_visibility` | 9/9 pass |
| focused Vitest（visibility / sessionIndex mapper / helpers / useThreadRows / sharedSessionSummaries / thread-list compat） | 70 pass |
| `tsc --noEmit` | pass（本 change 路径无新增 error） |

`openspec validate --all --strict` 中本 change 通过。其余失败项属于无关 active change，本收口未改。

## Code facts

- Index IPC 同包返回 `visibility`：`src-tauri/src/session_index/commands.rs`
- 只读 hide 权威（V0 ∪ 当前 V2 ∪ archived ∪ 有界 binding 历史）：`src-tauri/src/session_index/shared_visibility.rs`
- 有 Shared session 且 V2 只读失败 → `unavailable`，不得用 V0 残集当 first-paint 通行证
- last-verified 仅 `available + freshness=verified` 可写入
- early-paint 保留 `shared:*`，不整表冲掉 canonical Shared 行：`mergePreservedSharedThreadsForIndexFirstPaint`
- ADR 校准：`docs/research/mossx-multi-cli-provider-session-foundation-design.md`（2026-08-13）
- Catalog contract：`dev-guidelines/guides/workspace-session-catalog-contract.md`

## Residual

- 多代 rebuild 早于 last-archive、且 Index title 已写成 `Claude Session` 的历史容器，仍可能漏（P1，不在本收口范围）
- 实机冷启 / Shared rebuild 抽查未在本机 GUI 跑完；收口以自动化门禁 + 双轮代码审查为准

## Manual checklist（建议抽查）

- [ ] 冷启 Shared × Claude 工作区：无 Shared-owned `Claude Session` 闪现/常驻
- [ ] `shared:*` 首屏不先消失再回来
- [ ] Shared rebuild 后旧 native 容器仍隐藏
- [ ] 用户自建同名 `Claude Session` 仍可见
