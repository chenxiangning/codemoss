# codex-cross-source-history-unification Specification

## Purpose
TBD - created by archiving change fix-codex-source-switch-runtime-apply-2026-03-31. Update Purpose after archive.
## Requirements
### Requirement: Codex Thread History MUST Be Unified Across Sources Per Workspace
For the same effective session-management scope, Codex history list MUST aggregate entries across available sources/providers and present them in one default view.

#### Scenario: aggregate codex history for main workspace project scope
- **WHEN** session management requests Codex history for a main workspace
- **THEN** the system MUST aggregate local Codex session summaries for that main workspace and its child worktrees
- **AND** the system MUST return a single unified list instead of per-workspace sublists

#### Scenario: aggregate codex history for worktree-only scope
- **WHEN** session management requests Codex history for a worktree
- **THEN** the system MUST aggregate only that worktree's Codex history
- **AND** it MUST NOT implicitly merge sibling worktrees or the parent main workspace

#### Scenario: source switch does not hide old history by default
- **WHEN** user has history generated under source A and source B, and current active source is B
- **THEN** entries from source A MUST remain visible in the unified catalog
- **AND** user MUST NOT need app restart or source rollback to view source A history entries

#### Scenario: session catalog query pages unified history with stable cursor
- **WHEN** session management reads Codex history for an effective scope
- **THEN** the unified history capability MUST support cursor-based continuation over the aggregated result set
- **AND** repeated reads with identical inputs MUST preserve deterministic ordering across pages

### Requirement: Unified History MUST Preserve Source Identity Metadata
Unified history entries MUST include source/provider identity metadata for UI labeling and diagnostics.

#### Scenario: unified entry exposes source metadata
- **WHEN** an entry is returned by unified history list
- **THEN** entry payload MUST include non-empty source/provider identity field when available
- **AND** frontend MAY render this as source badge without altering entry identity

#### Scenario: unified entry includes source label and size metadata when available
- **WHEN** unified list entry can be enriched from local session summary
- **THEN** entry payload SHOULD expose `sourceLabel` for compact source/provider display
- **AND** entry payload SHOULD expose `sizeBytes` for thread size visibility in list UI

#### Scenario: unified entry exposes archive metadata when available
- **WHEN** an entry participates in session management catalog queries
- **THEN** the payload MUST expose archive visibility facts such as `archived` and/or `archivedAt`
- **AND** frontend MUST be able to distinguish active and archived entries without guessing from source paths

### Requirement: Unified History MUST Apply Deterministic Deduplication And Ordering
Aggregation MUST produce stable list behavior under repeated refresh and mixed-source duplicates.

#### Scenario: duplicate entry candidates are merged deterministically
- **WHEN** same logical session/thread appears from multiple aggregated sources
- **THEN** system MUST keep one canonical list entry by deterministic merge rules
- **AND** canonical selection MUST be repeatable across identical inputs

#### Scenario: unified list ordering is stable by recency
- **WHEN** unified list is returned with mixed-source entries
- **THEN** entries MUST be sorted by deterministic recency rule (newest first)
- **AND** repeated fetch without data change MUST keep identical order

### Requirement: Unified History MUST Degrade Gracefully
Failure in one source path MUST NOT collapse the entire Codex history list response.

#### Scenario: one codex root fails but other roots still return entries
- **WHEN** one Codex local history root fails to scan
- **AND** other roots for the same effective scope still succeed
- **THEN** the system MUST continue returning entries from successful roots
- **AND** response MUST indicate fallback or partial-source condition for diagnostics

#### Scenario: live thread/list fails but local aggregate succeeds
- **WHEN** active-source live `thread/list` request fails
- **THEN** system MUST still return local aggregated history entries when available
- **AND** response MUST indicate fallback/partial-source condition for diagnostics

#### Scenario: local scan fails but live thread/list succeeds
- **WHEN** local session scan path fails
- **THEN** system MUST still return live thread entries
- **AND** system MUST NOT return empty list solely due to local scan failure

#### Scenario: local scan fails for one owner workspace but others succeed
- **WHEN** project-scoped Codex history spans main workspace and worktrees
- **AND** local scan fails for one owner workspace but succeeds for others
- **THEN** the system MUST still return entries discovered from successful owner workspaces
- **AND** the failure MUST NOT collapse the whole project-scoped history response

### Requirement: Session Management Codex Catalog MUST Scan Default And Override Roots Together
When session management reads Codex history, it MUST combine workspace-specific override roots and default Codex roots so history is not silently hidden by home/source drift.

#### Scenario: default and override roots are scanned together
- **WHEN** a workspace has an explicit Codex home override and the user opens session management
- **THEN** the system MUST scan both the workspace override roots and the default Codex roots
- **AND** the system MUST deduplicate repeated session identities before returning results

#### Scenario: default-root history remains visible after workspace override is configured
- **WHEN** older Codex sessions for the same workspace still live under default `~/.codex`
- **AND** newer sessions are written under a workspace override root
- **THEN** session management MUST continue showing both sets of history in one unified catalog
- **AND** users MUST NOT need to manually switch source or codex-home configuration to see the older sessions

### Requirement: Unified Codex Session Catalog MUST Preserve Owner Workspace Identity In Project Scope
Project-scoped Codex history entries MUST preserve the workspace that actually owns the session so downstream archive/delete routing can stay correct.

#### Scenario: unified codex entry carries owner workspace id
- **WHEN** a Codex entry is returned in a project-scoped session management catalog
- **THEN** the payload MUST carry the owner workspace id for that session
- **AND** downstream mutation flow MUST be able to route archive or delete to that owner workspace without guessing

### Requirement: Unified History MUST Preserve Known Sessions Under Local-Scan Degradation
When local session scan is unavailable, unified history MUST keep already-known workspace session continuity and expose explicit degradation marker.

#### Scenario: local scan unavailable reuses cached known session identities
- **WHEN** local session scan fails for current workspace
- **AND** system has cached known session identifiers from previous successful scans
- **THEN** unified history merge MUST reuse cached identifiers to keep relevant live entries visible
- **AND** response MUST include `partialSource = "local-session-scan-unavailable"` for diagnostics

#### Scenario: degradation marker clears after local scan recovery
- **WHEN** a subsequent local scan succeeds
- **THEN** system MUST refresh known session identifiers from latest local summaries
- **AND** response MUST NOT keep stale `partialSource` degradation marker
