## MODIFIED Requirements

### Requirement: Codex Thread Listing MUST Recover From Workspace Connectivity Drift
During conversation list lifecycle, transient `workspace not connected` failures MUST be recoverable.

#### Scenario: reconnect then retry thread list once
- **WHEN** `thread/list` returns `workspace not connected`
- **THEN** client MUST reconnect workspace before surfacing failure
- **AND** client MUST retry the same list request once after reconnect success

#### Scenario: reconnect failure remains recoverable
- **WHEN** reconnect fails
- **THEN** system MUST keep previously loaded list state available
- **AND** UI MUST remain interactive without forced full reset
