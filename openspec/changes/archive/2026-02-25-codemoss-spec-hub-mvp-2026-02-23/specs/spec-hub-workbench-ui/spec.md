# spec-hub-workbench-ui Specification Delta

## ADDED Requirements

### Requirement: Spec Hub Three-Column Layout with Execution Console

The system SHALL provide a Spec Hub workbench with three coordinated columns: change list, artifact panel, and execution
console.

#### Scenario: Open Spec Hub main workspace

- **WHEN** user enters Spec Hub
- **THEN** UI SHALL render change list, artifact panel, and execution console in one screen context
- **AND** selected change context SHALL remain synchronized across all columns

#### Scenario: Execution console tabs are available

- **WHEN** execution console is rendered
- **THEN** UI SHALL expose tabs for actions, guards, timeline, and environment diagnostics
- **AND** tab switching SHALL keep current change context unchanged

### Requirement: Execution Console Blocker Visibility

The system SHALL show preflight blockers before users trigger actions.

#### Scenario: Action blocked by missing preconditions

- **WHEN** user selects an action that requires unavailable artifacts or unhealthy provider state
- **THEN** execution console actions tab SHALL display blocker reason and severity
- **AND** action trigger SHALL remain disabled until blocker is cleared

### Requirement: Structured Validation Feedback in Execution Console

The system SHALL present validation outcomes in a structured and locatable form.

#### Scenario: Validation failure rendering

- **WHEN** validation returns one or more failures
- **THEN** execution console SHALL display failed target, reason, and remediation hint
- **AND** user SHALL be able to navigate directly to the affected change/spec context

### Requirement: Icon-Plus-Label Semantic Consistency

The system MUST use consistent icon-plus-label semantics for status, risk, and action outcome in Spec Hub.

#### Scenario: Status badge rendering

- **WHEN** a change status is shown in list or detail panel
- **THEN** UI SHALL render status icon and text label together
- **AND** the same status SHALL use the same icon mapping across all Spec Hub surfaces

### Requirement: Interactive Tasks Checklist Writeback

The system SHALL allow users to toggle tasks checkboxes in Tasks artifact view and persist the result to `tasks.md`.

#### Scenario: Toggle task checkbox successfully

- **WHEN** user clicks an unchecked or checked task item in Tasks tab
- **THEN** UI SHALL update the checkbox state and persist markdown change to current change `tasks.md`
- **AND** task progress summary and action availability SHALL refresh in-place after writeback success

#### Scenario: Task writeback fails

- **WHEN** checkbox writeback fails due to IO or permission errors
- **THEN** UI SHALL rollback checkbox to previous state
- **AND** UI SHALL display actionable error feedback without requiring page reload

### Requirement: Verify-Task Decoupling and Archive Gate Clarity

The system MUST keep verification result decoupled from manual task completion state and enforce explicit archive gates.

#### Scenario: Verify passes without mutating tasks

- **WHEN** user runs strict verify and validation passes
- **THEN** system SHALL NOT auto-check unchecked task items in Tasks artifact
- **AND** Tasks checklist SHALL remain user-confirmed state only

#### Scenario: Archive blocked by incomplete required tasks

- **WHEN** latest verify passes but required tasks are still incomplete
- **THEN** archive action SHALL remain disabled
- **AND** guards panel SHALL show blocker details for incomplete required tasks

### Requirement: Archive Blocked AI Takeover Entry

The system SHALL provide an AI takeover entry in execution console actions when archive is blocked or recently failed.

#### Scenario: Show takeover entry on archive blockers

- **WHEN** archive action has one or more blockers
- **THEN** actions tab SHALL render AI takeover entry with blocker details
- **AND** user SHALL be able to choose available engine before triggering takeover

#### Scenario: Show takeover entry on latest archive failure

- **WHEN** latest archive event is failed in timeline
- **THEN** actions tab SHALL show latest archive output as takeover context
- **AND** user SHALL be able to trigger AI takeover without leaving Spec Hub

#### Scenario: Takeover result is visible

- **WHEN** AI takeover run finishes
- **THEN** actions tab SHALL display returned summary/output
- **AND** Spec Hub SHALL refresh runtime state automatically

### Requirement: AI Takeover Execution Visibility

The system SHALL provide explicit execution visibility for archive AI takeover, including running status, phase
progress,
log stream, and completion outcome.

#### Scenario: Running state appears immediately after trigger

- **WHEN** user clicks AI takeover trigger in actions tab
- **THEN** UI SHALL show running state within an interaction-safe delay window
- **AND** trigger button SHALL enter loading/disabled state to prevent duplicate runs

#### Scenario: Phase progress is visible during takeover

- **WHEN** takeover run is in progress
- **THEN** UI SHALL show phase progress for kickoff, agent execution, and finalize steps
- **AND** completed/current/failed phase state SHALL be visually distinguishable

#### Scenario: Failure summary is structured

- **WHEN** takeover run fails
- **THEN** UI SHALL show failed phase, error summary, and suggested next action
- **AND** user SHALL be able to inspect latest run logs in the same panel

#### Scenario: Refresh outcome is explicit after completion

- **WHEN** takeover run finishes and runtime refresh is attempted
- **THEN** UI SHALL show refresh success or refresh failed outcome explicitly
- **AND** user SHALL know whether manual refresh is still required
