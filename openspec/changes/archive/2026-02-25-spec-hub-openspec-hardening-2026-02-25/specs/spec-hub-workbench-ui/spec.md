## MODIFIED Requirements

### Requirement: Execution Console Blocker Visibility

The system SHALL show preflight blockers before users trigger actions.

#### Scenario: Action blocked by missing preconditions

- **WHEN** user selects an action that requires unavailable artifacts or unhealthy provider state
- **THEN** execution console actions tab SHALL display blocker reason and severity
- **AND** action trigger SHALL remain disabled until blocker is cleared

#### Scenario: Action has truncated evidence risk

- **WHEN** critical artifacts are loaded with truncated content
- **THEN** execution console SHALL display explicit risk banner and affected artifact hint
- **AND** archive-related actions SHALL surface warning or blocker until risk is resolved

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
