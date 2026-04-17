## MODIFIED Requirements

### Requirement: Unified Cross-Engine Conversation Lifecycle Contract
The system MUST define consistent lifecycle semantics (delete, recent ordering, restart visibility, key tool card recoverability) across Claude, Codex, and OpenCode.

#### Scenario: lifecycle contract applies to all engines
- **WHEN** the system executes lifecycle-related conversation operations
- **THEN** semantics MUST remain consistent across all three engines
- **AND** engine-specific differences MUST stay inside internal adapter layers

#### Scenario: key tool card lifecycle parity across engines
- **WHEN** `commandExecution` or `fileChange` cards are produced in any engine session
- **THEN** lifecycle semantics for visibility and recovery MUST be equivalent across engines
- **AND** engine adapter differences MUST NOT leak to user-visible card continuity

#### Scenario: restart replay preserves key tool card continuity
- **WHEN** user restarts the app and reopens the same conversation
- **THEN** previously visible `commandExecution` and `fileChange` cards MUST be replayed from persisted history
- **AND** replayed card semantics MUST match pre-restart behavior
