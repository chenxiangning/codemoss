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
