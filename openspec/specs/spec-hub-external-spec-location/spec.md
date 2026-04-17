# spec-hub-external-spec-location Specification

## Purpose

定义 Spec Hub 在自定义外部规范根路径下的解析、可见性、安全边界与执行上下文契约，确保外置规范仓与默认工作区模式行为一致且可恢复。
## Requirements
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

#### Scenario: Project-root semantic auto-resolves nested openspec when present

- **WHEN** user provides an absolute custom Spec root pointing to a project root (not ending with `openspec`)
- **AND** `<project-root>/openspec` exists
- **THEN** runtime SHALL resolve that nested `openspec` directory as the effective Spec root
- **AND** provider detection, change discovery, and artifact loading SHALL operate on the resolved nested root

#### Scenario: Project-root input remains bootstrap-compatible when nested openspec is missing

- **WHEN** user provides an absolute project root as custom Spec root
- **AND** `<project-root>/openspec` does not yet exist
- **THEN** runtime SHALL keep the input recoverable (no unsafe broad path fallback)
- **AND** bootstrap/init actions SHALL still execute from project root context to allow creating `openspec/`

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

### Requirement: Active External Spec Root SHALL Be a First-Class File Read Boundary For Activity Jumps
The system SHALL treat the active external Spec root as an allowed file-read boundary for session activity file jump actions.

#### Scenario: Session file jump recognizes active external spec root
- **GIVEN** workspace has a configured active external Spec root
- **WHEN** user triggers a `File change` jump from session activity
- **THEN** path resolution SHALL include external Spec root as a valid read boundary
- **AND** runtime SHALL not downgrade this path to an invalid workspace-relative read

#### Scenario: External spec boundary remains explicit and safe
- **WHEN** the target file is not under the active external Spec root
- **THEN** runtime SHALL reject external-spec routing for that path
- **AND** system SHALL return recoverable path guidance instead of unsafe broad file access

#### Scenario: Windows and macOS root matching stay deterministic
- **WHEN** external Spec root matching runs on Windows or macOS
- **THEN** path comparison SHALL use normalized separators
- **AND** Windows matching SHALL be case-insensitive while preserving existing workspace behavior contracts
