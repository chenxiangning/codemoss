## ADDED Requirements

### Requirement: OMP Events MUST Normalize Into Canonical Facts

The system MUST normalize OMP ACP and RPC conversation events into the existing canonical event boundary before frontend projection.

#### Scenario: Text delta and terminal use different paths
- **WHEN** a text delta and terminal fact arrive through different forwarders
- **THEN** both MUST resolve to the same OMP logical thread, run and turn
- **AND** terminal settlement MUST preserve the accumulated text

### Requirement: OMP Terminal Settlement MUST Require Typed Evidence

The system MUST distinguish accepted, queued, streaming, tool, approval, cancel and terminal states; EOF or process exit alone MUST NOT imply successful turn completion.

#### Scenario: Process exits before terminal
- **WHEN** the OMP process exits without terminal evidence
- **THEN** the turn MUST enter recovery/error state
- **AND** foreground processing MUST NOT be cleared as successful

### Requirement: OMP History MUST Reconcile With Realtime State

The OMP history loader MUST map native session records to logical mossx threads and preserve message identity, ordering and completion state.

#### Scenario: Resume loads an existing session
- **WHEN** a user resumes an OMP native session
- **THEN** history MUST be loaded before new realtime events are applied
- **AND** replayed state MUST be semantically equivalent to a full realtime ingestion

### Requirement: OMP Recovery MUST Be Observable And Idempotent

Recovery after disconnect, malformed frame, missed terminal or daemon restart MUST be explicit, bounded and safe to repeat.

#### Scenario: Recovery is retried
- **WHEN** the same recovery signal is observed more than once
- **THEN** the runtime MUST not duplicate messages, turns or cleanup
- **AND** metrics MUST record the recovery reason and outcome
