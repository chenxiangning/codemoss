## MODIFIED Requirements

### Requirement: Deterministic Status Derivation

The system SHALL derive change status from artifact and validation evidence instead of free text metadata.

#### Scenario: Missing tasks causes blocked state

- **WHEN** a change lacks required execution artifact context for apply actions
- **THEN** runtime SHALL mark action availability as blocked
- **AND** runtime SHALL expose blocker reason for UI rendering

#### Scenario: Validation result updates status

- **WHEN** strict validation result is recorded for a change
- **THEN** runtime SHALL update change status based on latest validation outcome using persisted or recomputed verify
  evidence
- **AND** status transition SHALL be reflected in the change list without manual refresh

#### Scenario: Timeline history is unavailable

- **WHEN** in-memory timeline does not contain the last verify event
- **THEN** runtime SHALL still derive validation-related gate evidence from persistent verify state
- **AND** archive eligibility SHALL remain deterministic across page reloads
