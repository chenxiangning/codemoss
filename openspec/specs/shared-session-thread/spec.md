# shared-session-thread Specification

## Purpose

Defines the shared-session-thread behavior contract, covering Shared Session Is A Distinct Immutable Conversation Type.

## Requirements
### Requirement: Shared Session Is A Distinct Immutable Conversation Type

The system MUST allow users to create a `shared session` as a distinct conversation type alongside native `Codex`, `Claude`, `Gemini`, and `OpenCode` sessions, and MUST preserve that type after creation.

#### Scenario: user creates a shared session from new conversation flow

- **WHEN** the user creates a new conversation and chooses `shared session`
- **THEN** the system MUST create a conversation whose persisted type is `shared`
- **AND** conversation list, tabs, and reopen flows MUST recognize it as `shared` rather than as a native engine session

#### Scenario: shared session type remains fixed after creation

- **WHEN** the user reopens, renames, or continues an existing `shared session`
- **THEN** the system MUST preserve the `shared` conversation type
- **AND** the system MUST NOT silently convert that conversation into any native engine session type

### Requirement: Shared Session Maintains One Canonical Thread

A `shared session` MUST append all user turns and assistant outputs into one canonical shared thread even when the selected execution engine changes between turns.

#### Scenario: switching engine between turns keeps one shared history

- **WHEN** the user sends one turn with `Claude` and a later turn with `Codex` inside the same `shared session`
- **THEN** both turns MUST appear in one continuous shared conversation history
- **AND** the system MUST NOT create a second primary user-facing conversation just because the execution engine changed

#### Scenario: shared session identity stays stable across navigation surfaces

- **WHEN** the user leaves the active conversation and later returns through conversation list, topbar tab, or reopen flow
- **THEN** the system MUST resolve the same `shared session` identity
- **AND** the recovered conversation history MUST remain attached to that same shared thread

### Requirement: Shared Session Hidden Native Bindings Stay Internal

Native bindings owned by a `shared session` are runtime internals and MUST NOT become user-facing native conversations. This rule applies to every Shared-supported engine (`Claude`, `Codex`, `Kimi`, `Grok`, `OpenCode`), not only `Claude` / `Codex`.

The rule MUST apply consistently to ordinary native catalog projections, Session Index first-paint, soft refresh, continuity/fallback merge, and final sidebar rendering. The durable ownership source is the normalized union of:

- legacy Shared metadata (`bindings_by_engine` / `bindings_by_target`)
- current V2 `shared_binding_state.native_session_id`
- `provisioning_json.archivedNativeSessionId`
- bounded historical `nativeSessionId` values recorded on binding facts for that Shared Session

A visible `shared:*` canonical row remains the sole user-facing entry for that Shared Session.

#### Scenario: selector change does not create a visible native conversation

- **WHEN** the user switches selected engine inside a `shared session` but has not sent a new turn
- **THEN** the system MUST persist the shared selector state for that session
- **AND** the system MUST NOT create an extra user-visible native conversation only because of that selector change

#### Scenario: shared-owned native bindings are filtered from native list surfaces

- **WHEN** thread list / tabs / reopen flows include both native sessions and shared sessions
- **THEN** native bindings marked as shared-owned internals MUST remain hidden from native conversation surfaces for Claude, Codex, Kimi, Grok, and OpenCode
- **AND** users MUST continue the conversation through the `shared session` identity

#### Scenario: grok shared binding does not appear as native sidebar row

- **WHEN** a Shared Session turn executes on Grok and materializes a Hidden Native Binding
- **THEN** the thread list MUST NOT show a separate Grok native row for that binding
  (including sessions whose first message is a context-package marker)
- **AND** the only user-facing conversation row for that work MUST remain the `shared:*` identity

#### Scenario: kimi and opencode shared bindings stay hidden after real id finalizes

- **WHEN** a Shared Session turn executes on Kimi or OpenCode and the runtime later finalizes a real native session id
- **THEN** the durable binding MUST be updated to that real identity
- **AND** subsequent thread list / catalog merges MUST hide that native id from user-facing native surfaces

#### Scenario: Session Index first-paint excludes V2-only Shared bindings

- **WHEN** `list_session_index_for_workspace` returns a native row whose id is present only in V2 `shared_binding_state.native_session_id`
- **THEN** the response MUST provide the same normalized Shared ownership projection used by later native catalog reconciliation
- **AND** the first `setThreads` projection for that workspace MUST exclude the native row
- **AND** the corresponding `shared:*` canonical row MUST remain visible

#### Scenario: Session Index first-paint excludes legacy Shared bindings

- **WHEN** a Session Index row matches a hidden native binding recorded in legacy Shared metadata
- **THEN** the first ordinary native projection MUST exclude the row before it can render in the sidebar
- **AND** later Shared snapshot reconciliation MUST NOT reintroduce the binding

#### Scenario: archived and historical Shared containers stay hidden

- **WHEN** a Shared Binding has been rebuilt or rematerialized and the previous native session file still exists in the engine project directory
- **THEN** the visibility projection MUST include `archivedNativeSessionId` and any bounded historical native ids from binding facts
- **AND** Session Index first-paint and later merges MUST NOT render those historical containers as ordinary native rows
- **AND** the current `shared:*` row remains the sole user-facing entry

#### Scenario: unavailable ownership data never creates an unfiltered Session Index projection

- **WHEN** a fresh Session Index snapshot is available but its Shared ownership projection is unavailable
- **THEN** the client MUST preserve the last verified projection or keep the affected ordinary native rows pending
- **AND** it MUST NOT project the fresh rows with an empty hide set
- **AND** it MUST NOT persist those unfiltered rows as last-good or sidebarSnapshot
- **AND** it MUST NOT require a full native catalog, transcript scan, or unbounded history scan to recover first-paint

#### Scenario: unread V2 ownership while Shared sessions exist is unavailable

- **WHEN** the workspace has at least one Shared Session and the read-only V2 binding query fails or times out
- **THEN** the Session Index visibility projection MUST be unavailable
- **AND** the client MUST NOT treat leftover V0 ids or a non-empty collab hide set as a verified first-paint pass
- **AND** last-verified hide MUST be written only from a fully verified projection

#### Scenario: Session Index first-paint keeps shared canonical rows

- **WHEN** Session Index first-paint replaces ordinary native rows
- **THEN** existing or last-good `shared:*` canonical rows MUST remain in the sidebar snapshot
- **AND** leaked ordinary native rows from the previous snapshot MUST NOT be preserved by that merge

#### Scenario: empty Shared ownership still paints ordinary native rows

- **WHEN** the visibility projection is available and the workspace has no Shared-owned native ids
- **THEN** ordinary native Session Index rows MUST still be eligible for first-paint
- **AND** the system MUST NOT treat an empty hide set as unavailable ownership

#### Scenario: historical control-plane fallback remains exact

- **WHEN** a historical native container no longer has an active legacy or V2 binding but Session Index raw `title` or `nativeTitle` begins with a MOSSX program control token (`MOSSX_CONTEXT_PACKAGE`, `MOSSX_CONTEXT_ACCEPTED`, `MOSSX_NATIVE_CONTEXT_V1`, `MOSSX_SHARED_CONTEXT_V1`)
- **THEN** the sidebar MAY classify that container as Shared-owned and exclude it from ordinary native rows
- **AND** the classifier MUST use those exact protocol markers on unsanitized Index fields rather than the frontend display title
- **AND** a user-created conversation titled `Claude Session`, `Agent N`, or another similar generic title MUST remain visible unless independent Shared ownership evidence exists

#### Scenario: parent-id Shared child handling remains independent

- **WHEN** a native child row is hidden because its `parentThreadId` belongs to a Shared Session
- **THEN** the existing parent-tree, canvas, and Strip handling MUST continue to apply independently of Session Index owner classification
- **AND** this change MUST NOT alter normal native parent-child visibility rules
- **AND** the system MUST NOT claim Session Index Claude rows already carry complete parent metadata

### Requirement: Shared Session Folder Assignment Stays Separate From Native Assignment

`shared session` folder organization MUST target the canonical `shared:*` thread identity and MUST NOT reuse native engine folder assignment for its hidden bindings.

#### Scenario: native folder assignment rejects shared thread ids

- **WHEN** a caller attempts to move a `shared:*` thread through native session folder assignment
- **THEN** the native assignment path MUST reject the request instead of treating it as a `Claude` or `Codex` native session
- **AND** the system MUST preserve the existing shared session folder/root placement

#### Scenario: hidden native bindings do not define shared folder placement

- **WHEN** a `shared session` has hidden `Claude` or `Codex` native bindings
- **THEN** moving or projecting those hidden bindings MUST NOT be considered the durable folder assignment for the shared session
- **AND** users MUST continue to see the shared conversation through the canonical `shared:*` identity

#### Scenario: empty shared sessions may remain at root until shared assignment exists

- **WHEN** a newly created `shared session` has no completed turn yet
- **AND** no shared-specific folder assignment contract is available
- **THEN** the system MAY keep that empty shared session at project root
- **AND** later conversation activity MAY allow existing projection refresh logic to place it under the intended folder as a best-effort behavior

### Requirement: Shared Session History Rendering Preserves User Turns

Shared history replay MUST preserve user-message visibility even when source payloads are wrapper/fallback formats.

#### Scenario: wrapped user payload still renders one visible user bubble

- **WHEN** shared history contains user messages wrapped by context-sync or fallback prefixes
- **THEN** the replayed conversation MUST show a visible user bubble with the effective current request text
- **AND** the system MUST NOT drop that user bubble during history load or reopen

#### Scenario: optimistic reconcile does not truncate unmatched earlier user history

- **WHEN** local optimistic user bubbles coexist with delayed shared snapshot reconciliation
- **THEN** unmatched earlier optimistic user entries MUST be preserved until a deterministic match arrives
- **AND** the system MUST NOT truncate prior user history because of a broad fallback replace

### Requirement: Shared Pending Rebinding Is Safe And Deterministic

Pending placeholder rebind for shared/native bridge MUST avoid stale or ambiguous mappings, and MUST cover every Shared-supported engine that can finalize a native session id after send.

#### Scenario: pending rebind uses unique fresh placeholder

- **WHEN** runtime events arrive for a shared turn whose native thread id finalized after send
- **THEN** the bridge MUST rebind through a unique pending placeholder for the same workspace/engine
- **AND** subsequent turn events MUST route to the same shared thread identity

#### Scenario: pending rebind covers all shared engines

- **WHEN** a Shared Session pending binding exists for Claude, Codex, Kimi, Grok, or OpenCode
- **AND** a `thread/started` (or equivalent identity finalization) event arrives for that engine
- **THEN** the bridge MUST be allowed to rebind that engine's pending placeholder to the finalized native thread id
- **AND** the system MUST NOT limit this rebind path to Claude/Codex only

#### Scenario: stale or ambiguous pending placeholders are ignored

- **WHEN** multiple pending placeholders exist or the pending placeholder is stale
- **THEN** the bridge MUST reject fallback rebind for that event
- **AND** the system MUST avoid assigning that event to an unrelated shared conversation

### Requirement: Shared Session Recovery Preserves Engine Provenance

The system MUST preserve source-engine metadata for assistant messages and key activity facts inside a `shared session` so history remains explainable after replay and reopen.

#### Scenario: shared history retains source engine metadata

- **WHEN** a `shared session` contains assistant turns or key activity facts produced by different engines
- **THEN** persisted history MUST retain engine provenance for each relevant record
- **AND** replay consumers MUST be able to determine which engine produced that record

#### Scenario: reopen restores one shared conversation with provenance intact

- **WHEN** the user closes and later reopens an existing `shared session`
- **THEN** the system MUST restore one shared conversation history with source-engine metadata intact
- **AND** the system MUST NOT split that recovered history into multiple unrelated native engine conversations

### Requirement: Native Engine Sessions Remain Unchanged

Adding `shared session` support MUST NOT change the creation, reopen, or history semantics of existing native engine sessions.

#### Scenario: native session flow remains engine-scoped

- **WHEN** the user creates or reopens a native `Codex`, `Claude`, `Gemini`, or `OpenCode` conversation
- **THEN** the existing conversation MUST remain engine-scoped and follow its current native lifecycle
- **AND** the presence of `shared session` support MUST NOT force migration or conversion

### Requirement: Shared History Recovery MUST Remain Owned By The Shared Thread

Shared history reload MUST use the stable canonical `shared:<UUID>` identity independently from its
display title. A successful empty canonical projection MUST be treated as a valid empty Shared
Session. A projection failure MUST remain observable and retryable, and MUST NOT activate or expose
the Native history recovery card or Native automatic-recovery block.

#### Scenario: title changes after first user turn

- **WHEN** Shared Session presentation metadata changes from `Shared Session` to the first user
  message
- **THEN** Sidebar and history loading MUST continue using the original `shared:<UUID>`
- **AND** all canonical history MUST remain attached to that same Shared thread

#### Scenario: new Shared Session has no canonical turns

- **WHEN** a newly created Shared Session successfully loads an empty canonical projection
- **THEN** the history load MUST complete as a valid empty state
- **AND** the UI MUST NOT show the Native “current session needs recovery” card

#### Scenario: Shared projection temporarily fails

- **WHEN** canonical projection fails and no readable Legacy snapshot exists
- **THEN** the failure MUST remain observable in diagnostics
- **AND** selecting the Shared Session again MUST retry canonical loading
- **AND** the UI MUST NOT show the Native history recovery card
- **AND** the loader MUST NOT invoke a Native Codex or Claude history fallback

#### Scenario: Native history recovery remains unchanged

- **WHEN** a Native Session enters its existing history recovery failure state
- **THEN** the Native recovery card and action MUST remain available
- **AND** Shared-specific recovery rules MUST NOT alter that Native state
