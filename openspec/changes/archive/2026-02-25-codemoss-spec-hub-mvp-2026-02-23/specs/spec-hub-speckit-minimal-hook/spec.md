# spec-hub-speckit-minimal-hook Specification Delta

## ADDED Requirements

### Requirement: spec-kit Workspace Detection

The system SHALL detect spec-kit workspaces and label them with minimal support level.

#### Scenario: Detect spec-kit markers

- **WHEN** workspace contains spec-kit marker files or directory conventions
- **THEN** provider detection SHALL mark workspace as `spec-kit`
- **AND** support level SHALL be set to `minimal`

### Requirement: Read-Only Artifact Mapping

The system SHALL provide read-only artifact browsing for spec-kit workspaces through a normalized view.

#### Scenario: Open change detail in minimal mode

- **WHEN** user opens a change from spec-kit workspace
- **THEN** UI SHALL render available artifacts in read-only mode
- **AND** unmapped fields SHALL be surfaced as metadata without breaking the view

### Requirement: External Passthrough Entry

The system SHALL provide a passthrough entry for spec-kit native workflow commands and documentation.

#### Scenario: Open external workflow entry

- **WHEN** user requests unsupported action in minimal mode
- **THEN** UI SHALL provide external command or documentation jump entry
- **AND** UI SHALL display explicit message that full in-app execution is not supported

### Requirement: Explicit Capability Boundary Disclosure

The system MUST disclose unsupported capabilities for spec-kit minimal mode.

#### Scenario: Show unsupported action boundary

- **WHEN** user views execution console actions tab in spec-kit workspace
- **THEN** unsupported actions SHALL be labeled as unavailable by support boundary
- **AND** message SHALL explain that minimal mode includes detect, read-only, and passthrough only
