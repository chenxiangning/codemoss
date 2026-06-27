## 1. OpenSpec Contract

- [x] 1.1 Add delta specs for Codex wrapper retry, curated skill transport, and Claude Windows wrapper argv safety.
- [x] 1.2 Add design documenting rejected `--profile ... app-server`, degraded fallback, and mac-safe boundaries.

## 2. Codex Wrapper Transport

- [x] 2.1 Replace generated-profile wrapper retry with app-server-compatible degraded omission of ccgui-generated instructions.
- [x] 2.2 Preserve primary Codex launch behavior and user-authored instruction override handling.
- [x] 2.3 Update Codex backend tests to reject `--profile ccgui-generated-instructions app-server` and cover degraded diagnostics.

## 3. Claude Wrapper Transport

- [x] 3.1 Skip `--append-system-prompt` curated skill argv on Windows command wrappers.
- [x] 3.2 Keep macOS/Linux Claude curated skill injection unchanged.
- [x] 3.3 Add focused Claude command-args tests for wrapper skip and direct-path preservation.

## 4. History Compatibility Cleanup

- [x] 4.1 Keep high-confidence leaked stream-json history filtering for old polluted transcripts.
- [x] 4.2 Remove symptom-level Claude pending retry override added during the earlier history-focused pass.

## 5. Verification

- [x] 5.1 Run focused Codex app-server CLI tests.
- [x] 5.2 Run focused Claude stream/command tests and Claude history tests.
- [x] 5.3 Run frontend tests only for touched history loader if retained.
- [x] 5.4 Run `cargo check --manifest-path src-tauri/Cargo.toml --release`, `npm run typecheck`, `git diff --check`, and strict OpenSpec validation.

## 6. Windows primary transport correction

- [x] 6.1 Make Codex Windows primary app-server launch avoid ccgui-generated `developer_instructions` argv instead of waiting for wrapper fallback.
- [x] 6.2 Inject Windows Codex curated skills through `turn/start.collaborationMode.settings.developer_instructions` so enabled built-in skills remain usable without CLI argv transport.
- [x] 6.3 Disable Claude curated skill `--append-system-prompt` argv transport on Windows while preserving macOS/Linux behavior.
- [x] 6.4 Add focused regression tests for Windows Codex argv omission, Codex turn payload injection, and Windows Claude argv omission.
- [x] 6.5 Re-run focused Rust tests, release check, and strict OpenSpec validation.
