## MODIFIED Requirements

### Requirement: Shared Session Hidden Native Bindings Stay Internal

Native bindings owned by a `shared session` are runtime internals and MUST NOT become user-facing native conversations. This rule applies to every Shared-supported engine (`Claude`, `Codex`, `Kimi`, `Grok`, `OpenCode`), not only `Claude` / `Codex`.

The rule MUST apply consistently to ordinary native catalog projections, Session Index first-paint, soft refresh, continuity/fallback merge, and final sidebar rendering. The durable ownership source is the normalized union of:

- legacy Shared metadata (`bindings_by_engine` / `bindings_by_target`)
- current V2 `shared_binding_state.native_session_id`
- `provisioning_json.archivedNativeSessionId`
- bounded historical `nativeSessionId` values recorded on binding facts for that Shared Session

A visible `shared:*` canonical row remains the sole user-facing entry for that Shared Session.

#### Scenario: selector change does not create a visible native conversation

- **WHEN** a user selects a `Claude` or `Codex` worker in a `shared session`
- **THEN** the system may create or resume the required native session binding
- **AND** the UI MUST NOT add a standalone normal native conversation for that binding
- **AND** the existing `shared:*` conversation remains the user-facing entry

#### Scenario: shared-owned native bindings are filtered from native list surfaces

- **WHEN** a native session id is owned by a Shared Session binding
- **THEN** native conversation list surfaces MUST exclude that id from ordinary native rows
- **AND** the Shared Session row MUST remain visible
- **AND** user-created native conversations that are not Shared bindings MUST remain visible

#### Scenario: grok shared binding does not appear as native sidebar row

- **WHEN** a Shared Session contains a `grok` agent whose runtime has created or resumed its native session binding
- **THEN** the sidebar MUST NOT render a standalone native Grok row for that binding
- **AND** the `shared:*` row remains the sole user-facing conversation entry

#### Scenario: kimi and opencode shared bindings stay hidden after real id finalizes

- **WHEN** a `kimi` or `opencode` Shared agent transitions from a provisional binding to a real native session id
- **THEN** the visibility projection MUST recognize both normalized binding forms during the transition
- **AND** ordinary native list surfaces MUST NOT show a standalone row for either Shared-owned binding
- **AND** unrelated Kimi or OpenCode native conversations MUST remain visible

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
