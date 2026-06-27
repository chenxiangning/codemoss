## Why

Windows Codex sessions still fail when the built-in `lazy-senior-dev` curated skill is enabled, even after the previous wrapper fallback change. The earlier design projected generated instructions through `--profile`, but direct CLI verification shows `codex --profile <name> app-server` is invalid because `--profile` does not apply to the `app-server` command.

This needs a follow-up because the failure is not a skill-content problem. The same full curated skill body can initialize `codex app-server` through `-c developer_instructions=...` on a non-wrapper path; the broken part is the fallback transport design.

## Goals And Boundaries

- Make Windows `.cmd` / `.bat` Codex wrapper compatibility retry use only argument forms that `codex app-server` actually supports.
- Preserve enabled curated skills for Codex app-server sessions instead of disabling `lazy-senior-dev` or silently dropping skill bodies.
- Keep primary launch behavior unchanged for macOS, Linux, Windows direct executables, and Windows wrapper launches that initialize successfully.
- Keep diagnostics explicit when primary and fallback both fail, including the original initialize failure and the retry failure.
- Keep user-authored `developer_instructions` / `instructions` overrides authoritative.

## Non-Goals

- Do not remove the built-in `lazy-senior-dev` skill or change its content.
- Do not add frontend retry UI, a new Settings switch, or a per-workspace curated skill scope.
- Do not mutate the user's base `config.toml`.
- Do not rely on `--profile` for `codex app-server` unless Codex CLI later documents and supports that command shape.
- Do not change macOS/Linux curated skill injection behavior.

## What Changes

- Replace the invalid generated-profile fallback for Codex app-server wrapper retry with an app-server-compatible degraded retry that omits ccgui-generated instruction argv.
- Ensure wrapper compatibility retry does not pass the internal external-spec hint when that hint was the fragile generated argument.
- Ensure enabled curated skill instructions are either:
  - passed through the supported `-c developer_instructions=...` app-server argument when safe enough for the selected launch path; or
  - intentionally omitted only under an explicit, diagnosable fallback policy if preserving them would block session creation.
- Update backend tests so `--profile ccgui-generated-instructions app-server` is rejected as an invalid fallback expectation.
- Add coverage for the user-reported sequence: disable built-in skill, re-enable it on Windows, then create a Codex session without initialize failure.
- Preserve rollback behavior in `set_curated_skill_enabled`: if restarting existing Codex runtimes fails, settings must restore the previous `enabledCuratedSkillIds`.
- Apply the same Windows-wrapper transport boundary to Claude curated skill injection by skipping large `--append-system-prompt` argv only for Windows command wrappers.

## Technical Options

| Option | Summary | Decision |
| --- | --- | --- |
| Disable `lazy-senior-dev` on Windows | Avoid the long generated instruction body by platform-disabling the default built-in skill. | Rejected. It hides the bug and makes built-in skills unavailable on Windows. |
| Keep generated profile fallback | Write `$CODEX_HOME/ccgui-generated-instructions.config.toml` and pass `--profile ccgui-generated-instructions app-server`. | Rejected. Direct CLI verification shows `--profile` is not valid for `app-server`, so this fallback cannot be the contract. |
| Use supported `-c developer_instructions=...` for app-server retry | Keep all generated instructions on the app-server-supported config path, while trimming retry-only internal hints and preserving user args. | Preferred. It uses the real CLI contract and avoids the invalid profile transport. |
| Drop all ccgui-generated instructions only on wrapper retry | Start the retry with no ccgui-generated developer instructions while preserving user-authored args. | Chosen for Windows wrapper retry because `--profile ... app-server` is invalid and large generated argv is the failure source. Must be diagnosable and must not disable the setting. |

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `codex-app-server-wrapper-launch`: wrapper compatibility retry must not use `--profile` for `app-server`; retry transport must be based on command shapes supported by `codex app-server`.
- `curated-skill-bundles`: Codex curated skill injection must remain effective when users toggle built-in skills, and restart failure must not leave settings in a misleading enabled state.
- `claude-code-realtime-stream-visibility`: Claude Windows wrapper launch must preserve stream-json stdin while avoiding large curated skill body argv.

## Impact

- Rust backend launch arg construction in `src-tauri/src/backend/app_server_cli.rs`.
- Rust backend session spawn/restart path in `src-tauri/src/backend/app_server.rs` and curated skill setting restart behavior in `src-tauri/src/curated_skills.rs`.
- Focused Rust tests around Codex app-server args, Windows wrapper retry planning, and curated skill toggle restart rollback.
- Existing OpenSpec main specs for `codex-app-server-wrapper-launch` and `curated-skill-bundles`.
- No new dependencies, storage migrations, or frontend API changes.

## Acceptance Criteria

- `codex --profile ccgui-generated-instructions app-server` is no longer treated as a valid fallback design in tests or specs.
- With `lazy-senior-dev` enabled, Codex session creation on Windows wrapper environments no longer fails at initialize because of the invalid profile fallback.
- With `lazy-senior-dev` enabled, Claude session creation on Windows wrapper environments no longer passes the curated skill body through `--append-system-prompt` argv.
- Wrapper retry preserves user-authored Codex args and does not inject a competing `developer_instructions` value when the user already supplied one.
- If wrapper retry intentionally omits generated instructions as a last-resort degraded mode, the runtime/user-facing diagnostic must say that built-in skill injection was skipped for startup recovery.
- Turning the built-in skill off and then on again must either restart Codex runtimes successfully with the new enabled set or roll settings back with a visible error.
- Focused backend tests cover primary launch, wrapper retry launch planning, user override behavior, and the invalid `--profile ... app-server` regression.
- `openspec validate fix-codex-app-server-curated-skill-transport --strict --no-interactive` passes.
