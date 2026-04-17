# spec-hub-environment-doctor Specification Delta

## ADDED Requirements

### Requirement: Managed and BYO Mode Selection

The system SHALL support workspace-level runtime mode selection between managed mode and BYO mode.

#### Scenario: Persist mode preference

- **WHEN** user selects runtime mode for a workspace
- **THEN** system SHALL persist selected mode at workspace scope
- **AND** mode SHALL remain effective after app restart

### Requirement: Dependency Health Diagnostics

The system SHALL provide structured diagnostics for required tooling availability and version.

#### Scenario: Missing OpenSpec binary

- **WHEN** doctor check cannot locate `openspec` command in current mode
- **THEN** doctor SHALL report missing dependency with severity and repair guidance
- **AND** Spec Hub SHALL prevent execution actions that depend on unavailable binary

#### Scenario: Dependency version check

- **WHEN** required command is present
- **THEN** doctor SHALL report detected command path and version information
- **AND** result SHALL be visible in diagnostics panel

### Requirement: Safe Degrade to Read-Only

The system MUST degrade to read-only capability when execution prerequisites are not met.

#### Scenario: Doctor reports unhealthy environment

- **WHEN** runtime health state is unhealthy
- **THEN** Spec Hub SHALL keep browsing features available
- **AND** execution actions SHALL be disabled with explicit blocker messages

### Requirement: Recovery Guidance and Retry

The system SHALL provide recovery actions and retry path for failed environment checks.

#### Scenario: User retries after fixing environment

- **WHEN** user completes suggested fix and triggers doctor recheck
- **THEN** system SHALL rerun diagnostics and refresh health state
- **AND** previously blocked actions SHALL become available if prerequisites pass

