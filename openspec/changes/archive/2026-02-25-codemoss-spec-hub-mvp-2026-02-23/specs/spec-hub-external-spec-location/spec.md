# spec-hub-external-spec-location Specification Delta

## ADDED Requirements

### Requirement: Workspace-Scoped Configurable Spec Root

The system SHALL support a workspace-scoped configurable Spec root directory for Spec Hub.

#### Scenario: Save custom external Spec root

- **WHEN** user sets a custom Spec root directory in Spec Hub
- **THEN** system SHALL persist the setting as workspace-scoped configuration
- **AND** the configured path SHALL be used on next Spec Hub load without requiring re-entry

#### Scenario: Fallback to default Spec root

- **WHEN** user clears custom Spec root or clicks restore default
- **THEN** system SHALL resolve Spec root to `<workspace>/openspec`
- **AND** subsequent provider detection SHALL use the default root

### Requirement: Resolved Spec Root Drives Runtime Detection and Loading

The runtime SHALL resolve Spec root with priority `customSpecRoot > workspaceDefaultSpecRoot` and use the resolved
path for provider detection, change discovery, and artifact loading.

#### Scenario: Detect OpenSpec under external root

- **WHEN** workspace default path has no OpenSpec but custom Spec root contains valid OpenSpec structure
- **THEN** provider detection SHALL resolve to `openspec`
- **AND** change list and artifacts SHALL be loaded from the custom root

#### Scenario: Default root still works without custom config

- **WHEN** no custom Spec root is configured
- **THEN** runtime SHALL behave exactly as existing default mode (`<workspace>/openspec`)
- **AND** legacy projects with in-workspace OpenSpec SHALL remain unaffected

### Requirement: Invalid Spec Root MUST Be Recoverable and Safe

The system MUST block execution actions when custom Spec root is invalid and provide recoverable guidance.

#### Scenario: Invalid custom Spec root blocks actions

- **WHEN** custom Spec root is non-existent, inaccessible, non-directory, or missing required structure
- **THEN** runtime SHALL mark provider as unavailable for execution and expose structured blockers
- **AND** execution actions SHALL remain disabled until path is fixed or reverted

#### Scenario: Recover by selecting another path or restoring default

- **WHEN** user updates custom Spec root to a valid path or restores default root
- **THEN** runtime SHALL re-resolve provider and refresh snapshot in-place
- **AND** action availability SHALL recover without requiring application restart

### Requirement: Active Spec Root Visibility in Execution Context

The system SHALL expose active Spec root in execution-related context to avoid path ambiguity.

#### Scenario: Preflight and diagnostics include active root

- **WHEN** user opens actions or views blocker details
- **THEN** Spec Hub SHALL display current active Spec root used for resolution
- **AND** diagnostics SHALL reference that root when reporting path-related failures
