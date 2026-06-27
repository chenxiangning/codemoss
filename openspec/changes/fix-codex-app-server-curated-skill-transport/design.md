## Context

Windows failures were correlated with enabling the bundled `lazy-senior-dev` curated skill. The skill body itself is valid. The failure point is transport: ccgui-generated instructions are large and were passed through Windows command-wrapper argv.

The previous Codex wrapper fallback tried to move generated instructions into a generated `--profile ccgui-generated-instructions` config. Direct CLI verification shows that `codex --profile <name> app-server` is not a supported app-server command shape, so that fallback must not be the contract.

Claude has an analogous risk: curated skills are appended through `--append-system-prompt <large body>`. On Windows wrappers, that large argv payload sits next to the stream-json stdin protocol and can trigger the same class of boundary failure.

## Goals / Non-Goals

**Goals:**
- Preserve enabled built-in skills on healthy macOS, Linux, Windows direct executable, and healthy Windows wrapper primary launches.
- Make Windows wrapper retry/session creation usable when curated skill argv transport blocks startup.
- Remove the invalid Codex `--profile ... app-server` fallback.
- Keep old Claude polluted history filtering as compatibility cleanup, not as the primary fix.

**Non-Goals:**
- Do not disable or remove `lazy-senior-dev`.
- Do not change macOS/Linux launch contracts.
- Do not mutate user-authored Codex or Claude config files.
- Do not add a frontend setting or per-message curated skill scope.

## Decisions

### Decision 1: Codex wrapper retry uses degraded generated-instruction omission

Codex wrapper compatibility retry will preserve user-authored `codexArgs` but omit ccgui-generated `developer_instructions` when the generated transport would otherwise go through fragile wrapper argv.

Rejected alternatives:
- `--profile ccgui-generated-instructions app-server`: rejected because Codex app-server does not support that command shape.
- Disabling `lazy-senior-dev`: rejected because the user setting must remain enabled and usable on healthy paths.

### Decision 2: Keep primary launch behavior unchanged

Primary Codex launch still injects generated instructions through supported `-c developer_instructions=...` behavior. This protects macOS and healthy paths from behavioral regression.

### Decision 3: Claude skips curated append only for Windows wrappers

Claude direct/native paths keep `--append-system-prompt`. Windows command wrappers skip that generated argv body and continue to send user prompt content through stream-json stdin. This avoids touching macOS, which is already correct.

### Decision 4: History filtering remains a compatibility layer

Leaked stream-json envelope filtering is still useful for already polluted transcripts. It should not add frontend retry state-machine behavior. Source transport fixes must prevent new pollution.

## Risks / Trade-offs

- [Risk] Windows wrapper fallback session may start without the curated skill body for that process. → Mitigation: keep the setting enabled, preserve healthy-path injection, and surface diagnostics that startup recovery skipped built-in skill injection.
- [Risk] Users may expect `lazy-senior-dev` inside a degraded fallback session. → Mitigation: the session is usable rather than blocked; retrying after installing a direct executable or fixing wrapper path restores full injection.
- [Risk] Claude wrapper users lose curated skill injection on that launch path. → Mitigation: scope only to Windows wrappers; macOS/Linux/direct executable behavior remains unchanged.
- [Risk] Historical polluted sessions remain on disk. → Mitigation: keep high-confidence history filtering for stream-json envelope rows and adjacent polluted assistant echoes.
