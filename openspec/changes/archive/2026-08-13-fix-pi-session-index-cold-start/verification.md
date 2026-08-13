# verification: fix-pi-session-index-cold-start

## 结论

用户 2026-08-13 手测通过。重启后 `ai-reach` 左侧工作区列表可见 Native PI：`2+2`、`干啥腻`、`1+1+1`、`1+1`、`你在干什么`、`你好`。

## Artifacts

- `openspec validate fix-pi-session-index-cold-start --strict --no-interactive` 通过
- tasks 10/10 完成

## 自动化

- `cargo test --manifest-path src-tauri/Cargo.toml --lib pi_fingerprint_changes`
- `cargo test --manifest-path src-tauri/Cargo.toml --lib incremental_sync_helper`
- `npx vitest run src/features/threads/hooks/sessionIndexThreadSummaries.test.ts src/features/threads/hooks/useThreadActions.native-session-bridges.test.tsx`（19/19）
- `npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx -t "invalidates session index after pending pi"`

## 手测

- 重启前：live remap 可见 PI
- 重启后：Session Index 投影出同批 `pi:<id>` 行，不再退回不含 PI 的 last-good snapshot

## ADR

未命中基石文档更新触发器（engine registry / Shared 支持集合 / provider binding / canonical fact / context compiler / terminal ACK / recovery exit）。不回写 `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。
