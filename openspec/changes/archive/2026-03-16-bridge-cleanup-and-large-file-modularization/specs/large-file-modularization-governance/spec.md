## ADDED Requirements

### Requirement: Oversized File Detection Baseline
The system SHALL maintain a repository-wide baseline report for source/style files whose line count exceeds 3000.

#### Scenario: Baseline scan execution
- **WHEN** the large-file governance scan runs
- **THEN** all matching files above 3000 lines MUST be listed with path, line count, file type, and priority tier
- **AND** the baseline output MUST be version-traceable

### Requirement: Tiered Refactor Queue Governance
The system SHALL classify oversized files into priority tiers and execute modularization by tier.

#### Scenario: P0 triage
- **WHEN** files are evaluated for queue placement
- **THEN** Bridge-critical, entry-critical, and high-coupling files MUST be marked as P0
- **AND** P0 files MUST be scheduled before P1/P2 files unless explicitly deferred with rationale

### Requirement: Incremental Modularization with Facade Preservation
The system SHALL require incremental extraction behind compatibility facades for oversized files.

#### Scenario: Feature-preserving extraction
- **WHEN** a queued oversized file is refactored
- **THEN** external imports/command contracts MUST remain compatible for that batch
- **AND** behavior parity checks MUST pass before batch completion

### Requirement: Large-File Regression Sentry
The system SHALL provide CI sentry checks to prevent uncontrolled re-growth of oversized files.

#### Scenario: New oversized delta introduced
- **WHEN** a pull request introduces or grows a file beyond the governance threshold
- **THEN** CI sentry MUST emit a governance warning or gate failure according to configured rollout phase
- **AND** the pull request MUST include explicit exception rationale when bypass is requested

### Requirement: Completion Criteria for Governance Milestones
The system SHALL define measurable completion criteria for each governance phase.

#### Scenario: Phase completion review
- **WHEN** governance phase review is performed
- **THEN** review MUST include queue burn-down status, behavior parity evidence, and unresolved risk list
- **AND** transition to stricter enforcement MUST require passing these criteria
