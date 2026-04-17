## ADDED Requirements

### Requirement: Claude Prompt-Overflow Recovery Preserves Lifecycle Continuity

Within the unified conversation lifecycle contract, Claude prompt-overflow auto recovery MUST preserve thread/session continuity and produce deterministic terminal outcomes.

#### Scenario: recovery runs in the same claude thread lifecycle
- **WHEN** Claude turn hits prompt overflow and runtime triggers compact-retry
- **THEN** recovery flow SHALL stay bound to the same Claude thread/session lineage
- **AND** user-visible lifecycle progression SHALL remain a single continuous turn flow

#### Scenario: terminal error remains deterministic after recovery attempt
- **WHEN** one-shot compact-retry cannot recover the turn
- **THEN** runtime SHALL emit one deterministic terminal error outcome
- **AND** lifecycle state SHALL NOT remain stuck in pseudo-processing state

### Requirement: Claude Compaction Lifecycle Events Integrate Into Existing Conversation Event Stream

Claude compaction lifecycle MUST be represented in the existing conversation event stream so current frontend lifecycle handlers can consume them directly.

#### Scenario: compacting signal routes through existing lifecycle handlers
- **WHEN** runtime maps Claude compacting signal
- **THEN** the event SHALL be emitted as `thread/compacting`
- **AND** existing thread lifecycle handlers SHALL process it without engine-specific branching in UI surface

#### Scenario: compact boundary signal routes through existing compacted path
- **WHEN** runtime maps Claude compact boundary signal
- **THEN** the event SHALL be emitted as `thread/compacted`
- **AND** existing compacted message append/dedupe logic SHALL continue to apply

### Requirement: Cross-Engine Lifecycle Contract Remains Intact

Adding Claude compact-retry lifecycle semantics MUST NOT regress existing lifecycle behavior for Codex, OpenCode, and Gemini.

#### Scenario: non-claude lifecycle remains unchanged
- **WHEN** runtime handles turns from non-Claude engines
- **THEN** Claude-specific compact-retry and signal mapping SHALL NOT run
- **AND** existing lifecycle contracts for those engines SHALL remain unchanged
