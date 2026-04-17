## ADDED Requirements

### Requirement: Session Activity SHALL Support Read-Only Open For External Absolute Files
The system MUST allow `Session Activity` file jump actions to open readable external absolute paths in read-only mode when those paths are outside workspace root and outside active external spec root.

#### Scenario: Readable external absolute file opens in editor
- **WHEN** a `Read` or `File change` activity jump target is an absolute path outside workspace root and external spec root
- **AND** the file exists and is readable
- **THEN** the system MUST open the file content in editor surface
- **AND** the open operation MUST NOT fail with `Invalid file path`

#### Scenario: Missing or inaccessible external absolute file fails recoverably
- **WHEN** an external absolute jump target does not exist or is not readable
- **THEN** the system MUST show a recoverable error message
- **AND** session activity panel interactions MUST remain available

#### Scenario: External absolute file defaults to read-only behavior
- **WHEN** user opens an external absolute file from session activity
- **THEN** the system MUST treat the file as read-only by default
- **AND** save action MUST be blocked or no-op with explicit guidance

