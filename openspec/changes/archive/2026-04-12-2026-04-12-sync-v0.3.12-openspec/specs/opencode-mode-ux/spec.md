## MODIFIED Requirements

### Requirement: MCP Engine Inspection in Settings MUST Be Read-Only
MCP information in settings MUST be engine-scoped and read-only.

#### Scenario: engine switch updates read-only MCP inspection view
- **WHEN** user switches inspected engine in settings MCP panel
- **THEN** panel MUST show config/runtime inventory for that engine
- **AND** panel MUST NOT expose direct per-server mutation controls

#### Scenario: refresh re-reads snapshot without mutating runtime state
- **WHEN** user clicks refresh in settings MCP panel
- **THEN** system MUST reload latest config/runtime snapshot
- **AND** current runtime enable/disable state MUST remain unchanged
