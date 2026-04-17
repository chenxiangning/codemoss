## ADDED Requirements

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
