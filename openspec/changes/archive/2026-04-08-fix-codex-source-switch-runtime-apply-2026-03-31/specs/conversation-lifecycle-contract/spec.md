## ADDED Requirements

### Requirement: Codex Config Reload MUST Preserve Conversation Visibility Continuity
Within conversation lifecycle contract, Codex config reload MUST preserve thread visibility and historical reopen entry points.

#### Scenario: thread list remains visible after successful reload
- **WHEN** user reloads Codex config successfully during active workspace session
- **THEN** existing thread list MUST remain visible to lifecycle consumers
- **AND** system MUST NOT reset conversation visibility to empty state solely due to reload

#### Scenario: historical reopen remains continuous after reload
- **WHEN** user performs external config change and completes client-side reload, then reopens existing Codex thread
- **THEN** historical messages MUST remain recoverable via same reopen flow
- **AND** lifecycle identity continuity MUST remain consistent with pre-reload state

### Requirement: Codex Lifecycle View MUST Be Cross-Source Unified By Default
For a workspace, Codex lifecycle history view MUST present a unified cross-source list by default rather than source-isolated partitions.

#### Scenario: default history list includes sessions from multiple sources
- **WHEN** workspace has Codex sessions created under multiple sources/providers
- **THEN** lifecycle history list MUST include entries across those sources in one unified timeline
- **AND** user MUST NOT need source switch just to make previously existing history visible

#### Scenario: unified list keeps source identity metadata
- **WHEN** lifecycle consumers read unified history entries
- **THEN** each entry MUST preserve source/provider metadata for identification
- **AND** metadata presence MUST NOT change reopen semantics

### Requirement: Codex History Reopen MUST Remain Stable Across Source Context Changes
Changing source context and reloading config MUST NOT break reopen behavior for already visible history entries.

#### Scenario: reopen historical thread after source change and reload
- **WHEN** user switches source externally, triggers client reload, and reopens an older history entry
- **THEN** system MUST recover historical messages for that entry
- **AND** system MUST NOT report false not-found solely due to current active source mismatch

### Requirement: Codex Config Reload MUST Keep Cross-Engine Lifecycle Parity
Adding Codex config reload and unified history capability MUST NOT regress lifecycle semantics of Claude and Gemini.

#### Scenario: claude lifecycle behavior remains unchanged
- **WHEN** Claude sessions continue after Codex reload/unified-history capability is introduced
- **THEN** Claude lifecycle semantics for reopen, ordering, and continuity MUST remain unchanged
- **AND** Codex-specific logic MUST stay isolated from Claude adapter path

#### Scenario: gemini lifecycle behavior remains unchanged
- **WHEN** Gemini sessions continue after Codex reload/unified-history capability is introduced
- **THEN** Gemini lifecycle semantics for reopen and visibility MUST remain unchanged
- **AND** Codex-specific logic MUST stay isolated from Gemini adapter path
