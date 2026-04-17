## MODIFIED Requirements

### Requirement: File-Change Jump MUST Route By Path Domain Without Regressing Workspace Flow
The system SHALL route `File change` jump targets by path domain and MUST preserve existing workspace file-open behavior.

#### Scenario: Workspace file path keeps existing open pipeline
- **WHEN** a `File change` event path resolves inside active workspace root
- **THEN** the system SHALL keep using the existing workspace file open/read pipeline
- **AND** no additional external-spec routing SHALL be applied

#### Scenario: External spec path uses external spec read route
- **GIVEN** an active external spec root is visible in session context
- **WHEN** a `File change` event path resolves inside that external spec root but outside workspace root
- **THEN** the system SHALL open the file through the external spec read route
- **AND** the editor surface SHALL present content without triggering `Invalid file path`

#### Scenario: External absolute path uses external absolute read route
- **WHEN** a `File change` event path resolves to an absolute file path outside both workspace root and active external spec root
- **AND** the target file is readable
- **THEN** the system SHALL open the file through the external absolute read route
- **AND** the editor surface SHALL present content without triggering `Invalid file path`

#### Scenario: Unsupported external path fails safely
- **WHEN** a `File change` event path is outside recognized path domains or is not readable
- **THEN** the system SHALL show a recoverable hint
- **AND** session activity interaction SHALL remain available without crash

#### Scenario: Cross-platform path normalization is honored
- **WHEN** path matching is evaluated on macOS or Windows
- **THEN** the system SHALL normalize path separators before comparison
- **AND** Windows drive-letter comparisons SHALL be case-insensitive

