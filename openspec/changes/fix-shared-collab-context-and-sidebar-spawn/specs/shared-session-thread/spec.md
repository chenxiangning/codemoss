## ADDED Requirements

### Requirement: Sidebar MUST hide Shared control-plane and hidden-binding spawn rows

The workspace thread list MUST NOT present Shared-owned hidden native bindings or context-protocol control-plane sessions as top-level user sessions.

#### Scenario: MOSSX_CONTEXT title native row is stripped

- **WHEN** a native thread summary name or mapped title classifies as context-protocol control text (e.g. `MOSSX_CONTEXT_PACKAGE:…`)
- **THEN** the sidebar list MUST exclude that native row
- **AND** Shared rows (`shared:…`) MUST remain visible

#### Scenario: hide set still wins for binding ids

- **WHEN** `list_shared_sessions` reports `nativeThreadIds` that expand to a catalog session id
- **THEN** that id MUST be stripped from the visible thread list after merge
- **AND** async refresh MUST NOT reintroduce it via stale empty hide sets (existing freshness rules still apply)

#### Scenario: truncated MOSSX_ program title is stripped (sidebar title gate)

- **WHEN** a native thread summary `name` is a truncated control-plane title that **starts with** `MOSSX_` (e.g. `MOSSX_CONTEXT_PACKAGE:sha25…` after `previewThreadName` clip)
- **THEN** the sidebar list MUST exclude that native row even if strict `classifyContextProtocolText` returns null
- **AND** this rule applies to known program tokens at least: `MOSSX_CONTEXT_PACKAGE`, `MOSSX_CONTEXT_ACCEPTED`, `MOSSX_NATIVE_CONTEXT_V1`, `MOSSX_SHARED_CONTEXT_V1`
- **AND** Shared top-level rows (`shared:…` / `threadKind: shared`) MUST remain visible

#### Scenario: raw firstMessage control-plane is filtered before title clip

- **WHEN** a native catalog/list session has raw `firstMessage` or `title` that is program control-plane text (line-start `MOSSX_*` or full protocol classify or collab worker multi-line)
- **THEN** merge helpers MUST drop that session before (or without depending solely on) clipped display name
- **AND** Grok / Kimi / Gemini / Claude / OpenCode merge paths MUST apply the same control-plane gate

#### Scenario: user prose mentioning MOSSX mid-title is preserved

- **WHEN** a native thread title discusses protocol tokens without line-start `MOSSX_` (e.g. `请解释 MOSSX_CONTEXT_PACKAGE 是什么`)
- **THEN** the sidebar list MUST NOT strip that row solely for containing the substring

#### Scenario: provider-continuation control title is rewritten not dropped

- **WHEN** a catalog session has `originKind` of `provider-continuation` and a control-plane package title (full or truncated line-start `MOSSX_`)
- **THEN** the merge path MUST rewrite the display name to a readable continuation title (e.g. `继续：…`)
- **AND** MUST NOT leave a raw `MOSSX_*` package string as the sidebar title

#### Scenario: canvas transcript filter stays strict

- **WHEN** conversation items are filtered for canvas presentation
- **THEN** the system MUST continue to use the strict versioned context-protocol classifier
- **AND** MUST NOT broaden canvas filtering to bare `includes("MOSSX")` or line-start-only rules that would hide ordinary user messages discussing protocol markers
