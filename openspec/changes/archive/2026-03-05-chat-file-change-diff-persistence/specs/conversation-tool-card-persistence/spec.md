## ADDED Requirements

### Requirement: Restart-Recoverable Tool Card Persistence
The system MUST persist `commandExecution` and `fileChange` tool cards so they are restart-recoverable in conversation history.

#### Scenario: command execution card survives restart
- **WHEN** a conversation contains at least one `commandExecution` card
- **AND** the application is restarted
- **THEN** reopening the conversation SHALL display that card in history

#### Scenario: file change card survives restart
- **WHEN** a conversation contains at least one `fileChange` card
- **AND** the application is restarted
- **THEN** reopening the conversation SHALL display that card in history with file metadata

### Requirement: Realtime-History Semantic Equivalence For Tool Cards
Tool card semantics MUST stay equivalent between realtime rendering and history replay.

#### Scenario: realtime card fields are preserved in history replay
- **WHEN** realtime stream emits a `fileChange` card with path/status/diff stats
- **THEN** persisted history SHALL preserve those fields for replay
- **AND** replayed rendering SHALL keep header aggregate and per-file stats consistent

#### Scenario: command output continuity
- **WHEN** realtime stream emits a `commandExecution` card with output text
- **THEN** persisted history SHALL preserve recoverable output payload
- **AND** replayed card SHALL remain readable in history detail view

### Requirement: Shared Diff Entry Contract For File Changes
`File changes` file rows SHALL use the same diff-entry contract as existing edit-related file entry points.

#### Scenario: click file change row opens existing diff flow
- **WHEN** user clicks a file row inside `File changes`
- **THEN** system SHALL route through the existing `onOpenDiffPath` pipeline
- **AND** system SHALL focus the resolved file in the current diff experience

#### Scenario: unresolvable path is handled safely
- **WHEN** the clicked file path cannot be resolved to an available diff target
- **THEN** system SHALL show a recoverable hint instead of crashing
- **AND** conversation interaction SHALL remain available

### Requirement: Reused Component Behavior Preservation
Integrating conversation card entry points MUST NOT alter behavior of reused Git diff components.

#### Scenario: integration does not override diff component defaults
- **WHEN** conversation-triggered file diff opens via reused component
- **THEN** integration SHALL NOT force-reset component defaults or user preference state
- **AND** existing toolbar and view-mode semantics SHALL remain unchanged

#### Scenario: legacy entry points remain unchanged
- **WHEN** user opens diff from pre-existing entry points (e.g., git panel or batch edit list)
- **THEN** behavior SHALL remain equivalent to pre-change baseline
- **AND** no regression SHALL be introduced by conversation integration
