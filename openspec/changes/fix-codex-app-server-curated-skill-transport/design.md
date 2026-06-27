## Context

Windows failures were correlated with enabling the bundled `lazy-senior-dev` curated skill. The skill body itself is valid. The failure point is transport: ccgui-generated instructions are large and were passed through Windows process argv during engine startup.

The previous Codex wrapper fallback tried to move generated instructions into a generated `--profile ccgui-generated-instructions` config. Direct CLI verification shows that `codex --profile <name> app-server` is not a supported app-server command shape, so that fallback must not be the contract.

Claude has an analogous risk: curated skills are appended through `--append-system-prompt <large body>`. On Windows, that large argv payload sits next to the stream-json stdin protocol and can trigger the same class of boundary failure.

## Goals / Non-Goals

**Goals:**
- Preserve enabled built-in skills on macOS/Linux launch paths and Windows Codex turns.
- Make Windows Codex session creation usable when curated skill argv transport blocks startup.
- Keep Windows Codex built-in skills usable through `turn/start.collaborationMode.settings.developer_instructions`.
- Remove the invalid Codex `--profile ... app-server` fallback.
- Keep old Claude polluted history filtering as compatibility cleanup, not as the primary fix.

**Non-Goals:**
- Do not disable or remove `lazy-senior-dev`.
- Do not change macOS/Linux launch contracts.
- Do not mutate user-authored Codex or Claude config files.
- Do not add a frontend setting or per-message curated skill scope.

## Decisions

### Decision 1: Codex Windows launch omits generated-instruction argv

Codex Windows app-server launch will preserve user-authored `codexArgs` but omit ccgui-generated `developer_instructions` from process argv on both primary and retry paths. This avoids making the broken primary attempt fail before fallback can help.

Rejected alternatives:
- `--profile ccgui-generated-instructions app-server`: rejected because Codex app-server does not support that command shape.
- Disabling `lazy-senior-dev`: rejected because the user setting must remain enabled and usable on healthy paths.

### Decision 2: Codex Windows turns carry generated instructions in JSON-RPC settings

Codex already sends `turn/start.collaborationMode.settings.developer_instructions` for execution policy. Windows app-server turns will merge the external spec priority hint and enabled curated skill block into that same settings field. This keeps built-in skills usable without launch argv transport.

### Decision 3: Keep macOS/Linux Codex launch behavior unchanged

macOS/Linux Codex launch still injects generated instructions through supported `-c developer_instructions=...` behavior. This protects the working platforms from behavioral regression.

### Decision 4: Claude skips curated append on Windows

Claude macOS/Linux paths keep `--append-system-prompt`. Windows skips that generated argv body and continues to send user prompt content through stream-json stdin. This avoids touching macOS, which is already correct.

### Decision 5: History filtering remains a compatibility layer

Leaked stream-json envelope filtering is still useful for already polluted transcripts. It should not add frontend retry state-machine behavior. Source transport fixes must prevent new pollution.

## Risks / Trade-offs

- [Risk] Windows Codex first-turn settings payload may be unsupported by older app-server builds. → Mitigation: use the existing `collaborationMode.settings.developer_instructions` path already used for execution policy and keep the existing capability fallback behavior.
- [Risk] Claude Windows users lose curated skill injection on that launch path. → Mitigation: scope only to Windows; macOS/Linux behavior remains unchanged and Windows sessions remain usable instead of showing raw JSON user bubbles.
- [Risk] Historical polluted sessions remain on disk. → Mitigation: keep high-confidence history filtering for stream-json envelope rows and adjacent polluted assistant echoes.
