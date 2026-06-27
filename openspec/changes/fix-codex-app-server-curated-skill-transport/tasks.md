## 1. OpenSpec Contract

- [x] 1.1 Add delta specs for Codex wrapper retry, curated skill transport, and Claude Windows wrapper argv safety.
- [x] 1.2 Add design documenting rejected `--profile ... app-server`, degraded fallback, and mac-safe boundaries.

## 2. Codex Wrapper Transport

- [x] 2.1 Replace generated-profile wrapper retry with app-server-compatible degraded omission of ccgui-generated instructions.
- [x] 2.2 Preserve primary Codex launch behavior and user-authored instruction override handling.
- [x] 2.3 Update Codex backend tests to reject `--profile ccgui-generated-instructions app-server` and cover degraded diagnostics.

## 3. Claude Wrapper Transport

- [x] 3.1 Skip `--append-system-prompt` curated skill argv only for Windows command wrappers.
- [x] 3.2 Keep macOS/Linux/Windows direct executable Claude curated skill injection unchanged.
- [x] 3.3 Add focused Claude command-args tests for wrapper skip and direct-path preservation.

## 4. History Compatibility Cleanup

- [x] 4.1 Keep high-confidence leaked stream-json history filtering for old polluted transcripts.
- [x] 4.2 Remove symptom-level Claude pending retry override added during the earlier history-focused pass.

## 5. Verification

- [x] 5.1 Run focused Codex app-server CLI tests.
- [x] 5.2 Run focused Claude stream/command tests and Claude history tests.
- [x] 5.3 Run frontend tests only for touched history loader if retained.
- [x] 5.4 Run `cargo check --manifest-path src-tauri/Cargo.toml --release`, `npm run typecheck`, `git diff --check`, and strict OpenSpec validation.
