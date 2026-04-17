# spec-hub-runtime-state Specification Delta

## ADDED Requirements

### Requirement: Unified Change Runtime Model

The system SHALL build a unified runtime model for each spec change, including provider type, artifacts completeness,
action availability, blockers, and lifecycle status.

#### Scenario: Build runtime state from workspace files

- **WHEN** Spec Hub loads a workspace
- **THEN** runtime SHALL parse change directories and artifact presence into a normalized model
- **AND** each change SHALL have a deterministic status value (`draft`, `ready`, `implementing`, `verified`, `archived`,
  `blocked`)

### Requirement: Deterministic Status Derivation

The system SHALL derive change status from artifact and validation evidence instead of free text metadata.

#### Scenario: Missing tasks causes blocked state

- **WHEN** a change lacks required execution artifact context for apply actions
- **THEN** runtime SHALL mark action availability as blocked
- **AND** runtime SHALL expose blocker reason for UI rendering

#### Scenario: Validation result updates status

- **WHEN** strict validation result is recorded for a change
- **THEN** runtime SHALL update change status based on latest validation outcome
- **AND** status transition SHALL be reflected in the change list without manual refresh

### Requirement: Workspace-Scoped Isolation

The system MUST isolate runtime state by workspace boundary.

#### Scenario: Switching workspace does not leak state

- **WHEN** user switches from workspace A to workspace B
- **THEN** runtime SHALL only expose changes under workspace B
- **AND** action history and blockers from workspace A SHALL NOT appear in workspace B view

### Requirement: Task Checklist Writeback State Synchronization

The runtime SHALL synchronize task completion state and action gates after tasks checklist writeback.

#### Scenario: Rebuild runtime after task checkbox writeback

- **WHEN** Tasks checklist change is persisted to current `tasks.md`
- **THEN** runtime SHALL recompute task progress from updated markdown
- **AND** actions and guards state SHALL reflect the latest completion state without full app restart

#### Scenario: Verify result does not overwrite manual task state

- **WHEN** strict verify is executed after manual task updates
- **THEN** runtime SHALL keep task completion source of truth from `tasks.md`
- **AND** verify result SHALL only affect validation-related gate evidence

### Requirement: Archive Failure Evidence for Takeover

The runtime SHALL expose archive gate evidence for AI takeover, including blockers and latest failed archive output.

#### Scenario: Runtime exposes archive blockers

- **WHEN** archive preflight detects missing target or requirement mismatch
- **THEN** runtime SHALL attach archive-specific blockers to selected change
- **AND** blockers SHALL be consumable by actions tab without re-parsing raw markdown

#### Scenario: Runtime preserves latest failed archive output

- **WHEN** archive command execution fails semantically
- **THEN** runtime timeline SHALL keep failed archive output text
- **AND** actions tab SHALL be able to use this output as AI takeover input context

### Requirement: AI Takeover Run Lifecycle State

The runtime SHALL maintain takeover execution lifecycle state for selected change, including current phase, log entries,
and refresh outcome.

#### Scenario: Runtime enters running lifecycle

- **WHEN** AI takeover is triggered from actions tab
- **THEN** runtime SHALL set takeover status to `running` with initialized phase state
- **AND** runtime SHALL expose start timestamp for elapsed-time rendering

#### Scenario: Runtime appends phase logs during execution

- **WHEN** takeover advances through engine call and finalize steps
- **THEN** runtime SHALL append structured log entries with phase and message
- **AND** UI consumers SHALL be able to render logs incrementally without page reload

#### Scenario: Runtime finalizes with success or failure

- **WHEN** takeover finishes
- **THEN** runtime SHALL set takeover status to `success` or `failed`
- **AND** runtime SHALL preserve latest summary/error for next panel render

#### Scenario: Runtime records refresh outcome

- **WHEN** takeover completion triggers runtime refresh
- **THEN** runtime SHALL persist refresh outcome as `refreshed` or `refresh_failed`
- **AND** UI SHALL be able to display whether manual refresh is needed
